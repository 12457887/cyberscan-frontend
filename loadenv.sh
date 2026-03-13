#!/bin/bash
set -a
source /var/www/myapp/frontend/.env.local
set +a
exec "$@"
