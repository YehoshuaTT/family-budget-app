# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install # התקן את כל התלויות, כולל devDependencies

# העתק את שאר הקוד רק אם אתה לא משתמש ב-volume שדורס את /app
# או אם אתה רוצה שה-build יהיה חלק מתהליך בניית האימג'
# COPY . .
# RUN npm run build # אפשר להריץ את ה-build הראשוני כאן או ב-command ב-compose

# הפורט של האפליקציה שלך
EXPOSE 3001
# CMD ["npm", "run", "dev"] # אפשר להגדיר את זה כאן או ב-compose