# HOME Router
A NodeJS reverse proxy with full authentication that has support for MFA applications such as Google Authenticator.

## What does HOME Router do?
HOME Router allows for easy proxying of anything and allows you to put a strong authentication system in front of any page (note: NOT for production security, this is mainly for securing development environments). The great part about this reverse proxy is that you do not need to port forward every single application, with this you just open one port (by default, 80) and we'll take care of the rest.

## How do I use HOME Router?
1. Setup your domain
    - HOME Router is based upon subdomains, so you need to configure your DNS to use it properly.
    - First, setup an A name that points to your server, e.g `home`
    - Next, setup a wildcard A name under the previous subdomain, e.g `*.home` (or, you can do it on a per-service basis, just make sure you at least have (home here is the main dashboard page) `home`, `auth.home`, and `unauthed.home` (unauthed is a redirect proxy, it may change in the future))

### Manual Setup
1. Clone/Download Repo
2. Make sure MongoDB and Redis is running
3. Change base url in config.js
4. Change the logo if ya want!
5. Run `sudo node .\dashboard\dashboard.js URL={YOUR BASE URL HERE}`
    - NOTE: Usually you must run as sudo because it is binding to port 80!
    - You can also run in PM2!
6. Done!

Really, it's THAT easy! The default login is username admin and password admin. You should immediately reset this and connect to your MFA of choice.

## SSL Setup
### Initialize SSL
1. Install nginx
    - Hopefully soon HTTPS will be built in, but for now, you need to proxy the proxy!
2. Create **WILDCARD** LetsEncrypt SSL certificate / other cert
3. Modify config.js
    - Change `ports.proxy = 81` (or any other port)
    - Set `this.protocol = "https"`
4. Create a server file and put the follow in it:
    - This may soon be automated if I can figure out a secure way to do so.
```
server {
        listen 80 default_server;

        server_name *.<BASE URL>$ <BASE URL>$;
        return 301 https://$host$request_uri;
}
server {
        listen  443 ssl;
        server_name ~^(.*)\.<BASE URL>$ <BASE URL>$;
        ssl_certificate /etc/letsencrypt/live/<BASE URL>/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/<BASE URL>/privkey.pem;
        location / {
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade; # Allows WebSockets
                proxy_set_header Connection "Upgrade";  # Allows WebSockets
                proxy_pass http://localhost:81;
        }
}
```
5. Restart nginx
    - sudo service nginx restart
6. Enjoy!

### Adding SSL to custom URL
1. Generate SSL Certificate
2. Create an app in the Proxy Dashboard
    - Set the Custom URL to whatever your URL will be.
2. Append this to the bottom of the file you created above:
    - This may soon be automated if I can figure out a secure way to do so.
```
server {
    listen 443 ssl;
    server_name <url> www.<url>;
    ssl_certificate /etc/letsencrypt/live/<URL>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<URL>/privkey.pem;
    location / {
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade; # Optional; Allows WebSockets
            proxy_set_header Connection "Upgrade";  # Optional; Allows WebSockets
            proxy_pass http://localhost:81;
    }
}
```
3. Restart Nginx

### Optional Environment Variables
1. DASHPORT (8081) - This is to access the Dashboard server
2. AUTHPORT (8082) - This is to access the Authorization server
3. DEAUTHEDPORT (8083) - This automatically redirects to Authorization server but is a required server.
4. PORT (80) - This is the main port for the entire proxy server (what redirects you to everywhere)
5. PROXYLOGS (false) - Set this to true to have a ton of BUNYAN logs from the Proxy (usually for development / debug only!)

## Use Cases
Personally, I use HOME Router on my home network to allow me to access Guacamole, VSCode, and developmental servers while remaining safe and secure. I really like knowing that even if a piece of premade software doesn't already have an authentication system that I can trust HOME Router to handle it for me, while being able to use MFA! It's also pretty nice how it works across applications, so it's all Single Sign On and then cookie-based from there. 

Are you using HOME Router? Leave an issue with your use case and I'll add it here!

## How can I help out?
The Trello for all upcoming features is here, take a look if you would like! https://trello.com/b/UPlQNXcH/home-router

Also, if you would like to monetarily support the creator, you can do so here: https://www.paypal.com/paypalme2/kentonv, I appreciate any support, from helping by fixing an issue on here to a little donation, everything helps!