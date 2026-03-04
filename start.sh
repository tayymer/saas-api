#!/bin/sh

echo "Running migrations..."
npx prisma migrate deploy

echo "Starting server..."
node dist/main.js