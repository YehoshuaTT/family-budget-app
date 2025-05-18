// backend/src/services/email.service.ts
import nodemailer from 'nodemailer';
import crypto from 'crypto'; // לשם יצירת הטוקן (אם לא משתמשים בספרייה ייעודית)
import { User } from '../entity/User';
import { AppDataSource } from '../data-source';

// ודא שמשתני הסביבה האלה מוגדרים ב-.env
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // הגדרות נוספות אם צריך, למשל TLS:
  // tls: {
  //   ciphers:'SSLv3'
  // }
});

export const sendPasswordResetEmail = async (userEmail: string, resetToken: string) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`; // ה-URL של עמוד איפוס הסיסמה בפרונטאנד

  const mailOptions = {
    from: `"Budget App" <${process.env.EMAIL_FROM_ADDRESS}>`, // שנה את "Budget App" לשם האפליקציה שלך
    to: userEmail,
    subject: 'בקשה לאיפוס סיסמה',
    text: `שלום,\n\nקיבלת אימייל זה מכיוון שאתה (או מישהו אחר) ביקשת לאפס את הסיסמה לחשבונך.\n\nאנא לחץ על הקישור הבא, או הדבק אותו בדפדפן שלך, כדי להשלים את התהליך תוך שעה אחת מקבלת אימייל זה:\n\n${resetLink}\n\nאם לא ביקשת זאת, אנא התעלם מאימייל זה והסיסמה שלך תישאר ללא שינוי.\n`,
    html: `<p>שלום,</p>
           <p>קיבלת אימייל זה מכיוון שאתה (או מישהו אחר) ביקשת לאפס את הסיסמה לחשבונך.</p>
           <p>אנא לחץ על הקישור הבא, או הדבק אותו בדפדפן שלך, כדי להשלים את התהליך תוך שעה אחת מקבלת אימייל זה:</p>
           <p><a href="${resetLink}">${resetLink}</a></p>
           <p>אם לא ביקשת זאת, אנא התעלם מאימייל זה והסיסמה שלך תישאר ללא שינוי.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to: ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    // אל תזרוק שגיאה שתגיע למשתמש, כדי לא לחשוף מידע
    // פשוט רשום את השגיאה בצד השרת
    return false;
  }
};

// פונקציה ליצירת טוקן ושמירתו למשתמש
export const generatePasswordResetToken = async (user: User): Promise<string | null> => {
  const userRepository = AppDataSource.getRepository(User);
  const resetToken = crypto.randomBytes(20).toString('hex'); // טוקן לא מוצפן (לשליחה במייל)

  // שמור את הטוקן (לא מוצפן) ואת תאריך התפוגה שלו למשתמש
  // לשיפור אבטחה, אפשר להצפין את הטוקן ב-DB, אבל זה מסבך את תהליך האימות
  user.passwordResetToken = resetToken; // שמירת הטוקן כפי שהוא, לא האש
  user.passwordResetExpires = new Date(Date.now() + 3600000); // תוקף לשעה אחת

  try {
    await userRepository.save(user);
    return resetToken; // החזר את הטוקן הלא מוצפן כדי לשלוח אותו במייל
  } catch (dbError) {
    console.error("Error saving password reset token to DB:", dbError);
    return null;
  }
};