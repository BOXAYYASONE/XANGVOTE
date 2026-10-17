# XANG_VOTE

เว็บโหวตคะแนนนักร้องแบบ Mobile-First สำหรับผู้ชมและผู้ดูแลระบบ โครงการนี้ใช้เทคโนโลยีและ schema ตาม [AGENTS.md](./AGENTS.md)

## สถานะการพัฒนา

Backend setup/schema (PHASE 1), public API (PHASE 2), Admin API (PHASE 3) และ frontend หน้าโหวต (PHASE 4) เสร็จแล้ว กำลังทำ PHASE 5: frontend หน้า Admin

## เทคโนโลยี

- Frontend: React, Vite, Tailwind CSS, React Router
- Backend: Node.js, Express
- Database: MySQL/MariaDB ผ่าน `mysql2`
- การยืนยันตัวตน/จัดการไฟล์/validation/security ใช้ dependencies ตามที่กำหนดใน `AGENTS.md`

ต้องใช้ Node.js 22 ขึ้นไป

## เริ่มต้นใช้งาน

### Backend

```powershell
Set-Location backend
npm install
Copy-Item .env.example .env
```

แก้ `ADMIN_USERNAME`, `ADMIN_PASSWORD` และ `JWT_SECRET` ใน `backend/.env` ก่อนสร้างฐานข้อมูลหรือเริ่ม server ระบบจะไม่สร้าง admin ด้วย credentials ที่กำหนดตายตัว และจะหยุดพร้อม error หากยังไม่มี admin และไม่ได้ตั้งค่าทั้งสองตัวแปร รหัส JWT ควรเป็น secret แบบสุ่มและยาว

สร้าง database ชื่อเดียวกับ `DB_NAME` ใน phpMyAdmin/XAMPP ก่อน จากนั้นตั้งค่า `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` และ `DB_NAME` ใน `.env` หาก MySQL ไม่มีรหัสผ่าน ให้กำหนด `DB_PASSWORD=` ไว้ได้
กำหนด `FRONTEND_ORIGIN` ให้ตรงกับ origin ของ frontend; API จะอนุญาต CORS เฉพาะ origin นี้

```powershell
npm run db:init
npm test
npm run dev
```

สคริปต์สร้างตาราง MySQL จาก `backend/src/config/schema.sql` และตั้ง `is_voting_open` เป็น `false` เมื่อสร้างครั้งแรก สามารถรันซ้ำได้ และจะเพิ่ม admin จาก env เมื่อ username นั้นยังไม่มี

### Frontend

```powershell
Set-Location frontend
npm install
npm run build
npm run dev
```

## Schema

- `singers`: ข้อมูลนักร้อง
- `votes`: คะแนน พร้อม unique constraint ต่อคู่ `singer_id` และ `voter_token`; ลบนักร้องแล้วคะแนนถูกลบด้วย foreign key cascade
- `settings`: การตั้งค่าระบบ โดยเริ่มต้นปิดการโหวต
- `admins`: ชื่อผู้ใช้และ bcrypt password hash

คะแนนรวมคำนวณจาก `votes` และไม่มี `vote_count` ใน `singers`

ทดสอบ backend ใช้ mock pool ของ `mysql2` ไม่เชื่อมต่อฐานข้อมูล XAMPP หรือฐานข้อมูลจริง

## Public API (PHASE 2)

- `GET /api/singers` คืนรายชื่อนักร้องพร้อมจำนวนคะแนนที่นับจาก `votes`
- `GET /api/settings/voting` คืนสถานะเปิดโหวตเป็น boolean
- `POST /api/singers/:id/vote` ตรวจสถานะเปิดโหวต, ป้องกันการโหวตซ้ำต่อ voter cookie และจำกัด 10 requests ต่อนาทีต่อ IP

## Admin API (PHASE 3)

- `POST /api/admin/login` ตรวจ credentials และตั้ง JWT ใน httpOnly cookie
- `POST /api/admin/logout` ลบ cookie (ต้องเข้าสู่ระบบ)
- `GET /api/admin/results` คืนรายชื่อนักร้องพร้อมคะแนนรวม
- `POST /api/admin/singers` เพิ่มนักร้องด้วย multipart fields `name` และ `image`
- `PUT /api/admin/singers/:id` แก้ชื่อและ/หรือรูปนักร้อง
- `DELETE /api/admin/singers/:id` ลบนักร้องและรูป (คะแนนถูกลบด้วย foreign key cascade)
- `PATCH /api/admin/voting` เปลี่ยนสถานะด้วย body `{ "open": true }` หรือ `{ "open": false }`

Admin routes (ยกเว้น login) ต้องยืนยันตัวตนด้วย JWT cookie รูปที่รับต้องเป็น JPG/PNG/WebP จริง ไม่เกิน 5 MB และจะถูกแปลงเป็น WebP ใน `backend/uploads/`

### Frontend API URL

หน้าโหวตใช้ `VITE_API_BASE_URL` เป็น base URL ของ backend (ค่าเริ่มต้น `http://localhost:3000`) เรียก API ผ่าน `frontend/src/services/` และส่ง cookie ด้วย `credentials: "include"` เมื่อโหวต

## Admin frontend (PHASE 5)

เปิด `/admin/login` เพื่อเข้าสู่ระบบ และ `/admin` สำหรับจัดการนักร้องกับสถานะโหวต หน้า Admin ตรวจ session ผ่าน Admin results API และใช้ httpOnly cookie โดยไม่เก็บ token ใน browser storage
