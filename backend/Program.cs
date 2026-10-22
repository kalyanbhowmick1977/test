using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<Store>();
builder.Services.AddAuthentication("session").AddCookie("session", options =>
{
    options.Cookie.Name = "pagebuilder.session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.SlidingExpiration = false;
    options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
    options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
    options.Events.OnValidatePrincipal = context =>
    {
        var store = context.HttpContext.RequestServices.GetRequiredService<Store>();
        if (!store.SessionActive(context.Principal?.FindFirstValue("sid") ?? "")) context.RejectPrincipal();
        return Task.CompletedTask;
    };
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 2_000_000);
var app = builder.Build();
var db = app.Services.GetRequiredService<Store>();
db.Initialize();
app.Use(async (context, next) =>
{
    // Cookie-authenticated writes must come from this origin (Vite preserves Origin via its proxy).
    var origin = context.Request.Headers.Origin.ToString();
    if (context.Request.Method is "POST" or "PUT" or "DELETE" or "PATCH" && origin.Length > 0)
    {
        var expected = app.Configuration["PB_FRONTEND_ORIGIN"];
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
            !(uri.Authority.Equals(context.Request.Host.Value, StringComparison.OrdinalIgnoreCase) && uri.Scheme == context.Request.Scheme) &&
            !string.Equals(origin, expected, StringComparison.OrdinalIgnoreCase))
        { context.Response.StatusCode = 403; await context.Response.WriteAsJsonAsync(new { message = "Invalid request origin." }); return; }
    }
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "same-origin";
    if (context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/Auth"))
        context.Response.Headers.CacheControl = "no-store";
    try { await next(context); }
    catch (PageConflictException ex) { context.Response.StatusCode = 409; await context.Response.WriteAsJsonAsync(new { message = ex.Message }); }
    catch (ArgumentException ex) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { message = ex.Message }); }
    catch (SqliteException ex) when (ex.SqliteErrorCode == 19)
    { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { message = "The page has invalid or conflicting metadata. Check required fields and unique codes." }); }
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", database = "SQLite" }));
app.MapPost("/Auth/Login", async (LoginRequest request, HttpContext context) =>
{
    var user = db.VerifyUser(request.Username ?? "", request.Password ?? "");
    if (user is null) return Results.Json(new { message = "Invalid username or password." }, statusCode: 401);
    var session = db.CreateSession(user.Value.Id);
    var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, user.Value.Id.ToString()), new Claim(ClaimTypes.Name, user.Value.Name), new Claim("sid", session) }, "session");
    await context.SignInAsync("session", new ClaimsPrincipal(identity), new AuthenticationProperties { IsPersistent = false });
    return Results.Ok(new { userId = user.Value.Id, username = user.Value.Name });
}).RequireRateLimiting("login");
app.MapGet("/Auth/Me", (HttpContext context) => Results.Ok(new { username = context.User.Identity!.Name })).RequireAuthorization();
app.MapPost("/Auth/Logout", async (HttpContext context) =>
{
    db.EndSession(context.User.FindFirstValue("sid")!);
    await context.SignOutAsync("session");
    return Results.NoContent();
}).RequireAuthorization();

var pages = app.MapGroup("/api/GenericPages").RequireAuthorization();
pages.MapGet("/", () => db.List());
pages.MapGet("/menu-locations", () => db.Menus());
pages.MapGet("/table-layout", (string? schema, string? table, string? column) => db.BusinessLayout(schema ?? "main", table ?? "", column ?? ""));
pages.MapGet("/{code}", (string code) => db.Get(code) is { } page ? Results.Ok(page) : Results.NotFound(new { message = "Page not found." }));
pages.MapPut("/{code}", (string code, JsonObject page) => Results.Ok(db.Save(code, page)));
pages.MapDelete("/{code}", (string code, string revision) => { db.Delete(code, revision); return Results.Ok(new { message = "Page and metadata deleted." }); });
// Explicitly reject API routes absent from this designer-only package.
app.Map("/api/{**path}", () => Results.NotFound(new { message = "This endpoint is not included in the standalone PageBuilder designer." }));
app.MapFallback(async context =>
{
    var index = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "index.html");
    if (File.Exists(index)) { context.Response.ContentType = "text/html"; await context.Response.SendFileAsync(index); }
    else { context.Response.StatusCode = 404; await context.Response.WriteAsync("Build the frontend or start its Vite development server. See README.md."); }
});
app.Run();

record LoginRequest(string? Username, string? Password);
sealed class PageConflictException(string message) : Exception(message);
