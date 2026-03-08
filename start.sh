#!/bin/sh
echo "Running migrations..."
npx prisma migrate deploy
echo "Running seed..."
npx prisma db seed
echo "Starting server..."
node dist/src/main.js