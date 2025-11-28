FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy htpasswd file
COPY .htpasswd /etc/nginx/.htpasswd

EXPOSE 80

