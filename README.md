# FF Portal — Apps Script + Google Sheets + Drive + GitHub Pages

## 1) ติดตั้งฐานข้อมูลและ API (Google Apps Script)
1. สร้าง Google Sheet ใหม่ (ตั้งชื่ออะไรก็ได้ เช่น FF-Portal-DB)
2. เมนู ส่วนขยาย → Apps Script → ลบโค้ดเดิม แล้ววางโค้ดจาก `apps-script/Code.gs`
3. แก้บรรทัดบนสุด `ADMIN_USERNAME` และ `ADMIN_PASSWORD` (อย่างน้อย 6 ตัว) → กด Save
4. เลือกฟังก์ชัน `setup` → กด เรียกใช้ → อนุญาตสิทธิ์ (Drive, Sheets) → ระบบสร้างแผ่นงานทั้งหมดให้
5. การทำให้ใช้งานได้ → การทำให้ใช้งานได้ใหม่ → ประเภท Web app → Execute as: **Me** / Who has access: **Anyone** → Deploy
6. คัดลอก Web app URL (ลงท้าย `/exec`)

แก้โค้ดภายหลัง: Deploy → Manage deployments → ดินสอ → เวอร์ชันใหม่ → Deploy (URL เดิมไม่เปลี่ยน)

## 2) นำหน้าเว็บขึ้น GitHub Pages
1. สร้าง repository ใหม่บน GitHub (Public) แล้วอัปโหลดไฟล์ในโฟลเดอร์นี้ทั้งหมด (ยกเว้น node_modules)
2. แก้ `public/config.js` ใส่ Web app URL ในบรรทัด `window.FF_API_URL = '...'`
3. Settings → Pages → Build and deployment → Source: **GitHub Actions**
4. push ที่ branch `main` → รอ Actions เสร็จ → ได้ลิงก์ `https://<user>.github.io/<repo>/`

## 3) ใช้งาน
เปิดลิงก์ → ล็อกอินด้วย ADMIN_USERNAME / ADMIN_PASSWORD → เมนู ตั้งค่า / จัดการสิทธิ์ / ลูกค้า

## รันในเครื่อง
```
npm install
npm run dev
```
(ใส่ API URL ที่หน้าแรก หรือใน public/config.js)

## ทดสอบตรรกะ backend (ไม่ต้องใช้ Google)
```
cd apps-script && node test.cjs && node shim-test.cjs
```

## ล็อกอินด้วย Gmail (Sign in with Google) — ให้สมาชิกใช้งานพร้อมกันคนละบัญชี
1. console.cloud.google.com → สร้างโปรเจกต์ → APIs & Services → OAuth consent screen: User type **External**, ใส่ชื่อแอปและอีเมลติดต่อ แล้วกด **Publish app** (ใช้แค่ email/profile ไม่ต้องรอ Google ตรวจสอบ) — ถ้าค้างที่สถานะ Testing จะเข้าได้เฉพาะ Test users
2. Credentials → Create credentials → OAuth client ID → Web application
   - Authorized JavaScript origins: `https://<user>.github.io` (เฉพาะโดเมน ไม่ใส่ path) และ `http://localhost:5173` (ถ้าทดสอบในเครื่อง)
3. คัดลอก Client ID ไปใส่ `GOOGLE_CLIENT_ID` ในบรรทัดบนของ `Code.gs` → Save → เลือกฟังก์ชัน `authorizeGoogle` กดเรียกใช้ (อนุญาตสิทธิ์) → Deploy เวอร์ชันใหม่
4. ผู้จัดการ: จัดการสิทธิ์ → เพิ่มผู้ใช้ → กรอก **อีเมล Gmail** + เลือกสิทธิ์ (ลูกค้าให้ผูกบริษัท) → เว้นรหัสผ่านว่าง
5. สมาชิกเปิดลิงก์เว็บ → กดปุ่ม Sign in with Google (ต้องเป็น Gmail ที่ลงทะเบียนไว้เท่านั้น)
