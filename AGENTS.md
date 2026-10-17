# AGENTS.md — XANG_VOTE

## Project overview
เว็บโหวตคะแนนนักร้องแบบง่าย Mobile-First
- **Voter (ผู้ชม):** เปิดมือถือ เห็นรูปและชื่อนักร้อง กดโหวตได้ทันที
- **Admin (ผู้ดูแล):** Login แล้วเพิ่ม/ลบนักร้อง เปิด-ปิดการโหวต และดูคะแนนรวม

ไม่ใช้ WebSocket หรือ real-time ทุกการอัปเดตใช้ REST API ธรรมดา

## Tech stack (ห้ามเปลี่ยนโดยไม่ถามก่อน)
- **Frontend:** React + Vite, Tailwind CSS, React Router
- **Backend:** Node.js + Express
- **Database:** MySQL/MariaDB ผ่าน `mysql2` (`mysql2/promise`)
- **Auth:** `bcrypt` สำหรับ hash รหัสผ่าน, JWT เก็บใน httpOnly cookie
- **Upload:** `multer` + `sharp`
- **Validation:** `zod`
- **Security:** `helmet`, `express-rate-limit`, `cookie-parser`

## Repository structure
```
backend/
  src/
    config/        # env, connection pool และ schema MySQL (`schema.sql`)
    controllers/   # รับ request ส่ง response เท่านั้น
    services/      # business logic (กติกาโหวต, อัปโหลดรูป)
    models/        # SQL queries
    routes/
    middlewares/   # auth, rate limit, validation, error handler
    app.js
  uploads/         # รูปนักร้อง (ไม่ commit)
  tests/
  .env.example
frontend/
  src/
    components/    # SingerCard, VoteButton, AdminNavbar
    pages/         # HomePage, LoginPage, AdminPage
    services/      # ฟังก์ชันเรียก API ทั้งหมดอยู่ที่นี่
    hooks/
    styles/
```

## Commands
- Backend: `npm install`, `npm run dev`, `npm test`
- Frontend: `npm install`, `npm run dev`, `npm run build`
- ก่อนจบงานทุกครั้ง ต้องรัน test และ build ให้ผ่าน
- ก่อนรัน `npm run db:init` ให้ตั้ง `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` ใน `backend/.env` และสร้าง database ว่างใน MySQL/MariaDB

ตัวอย่าง environment อยู่ใน `backend/.env.example`; ห้ามใส่ credentials จริงในไฟล์ตัวอย่างหรือ commit ไฟล์ `.env`

## Database schema
Schema เป็น MySQL ใช้ `utf8mb4` และ InnoDB อยู่ที่ `backend/src/config/schema.sql`
- `singers` (id, name, image_url, created_at)
- `votes` (id, singer_id FK → singers.id ON DELETE CASCADE, voter_token, created_at, UNIQUE(singer_id, voter_token))
- `settings` (setting_key PK, value) เช่น `setting_key = 'is_voting_open'`, value = `'true'` / `'false'`
- `admins` (id, username UNIQUE, password_hash)

**ห้ามเก็บ `vote_count` ในตาราง singers** คะแนนคำนวณด้วย `COUNT(*)` จาก `votes` เสมอ
Query ที่ใช้ค่าจากตัวแปรหรือผู้ใช้ต้องใช้ prepared statement และ placeholder `?` ของ `mysql2` เท่านั้น

## Business rules
- โหวตได้หนึ่งครั้งต่อนักร้องต่อ `voter_token` (สร้างจาก UUID เก็บใน httpOnly cookie)
- Rate limit การโหวต: ไม่เกิน 10 ครั้งต่อนาทีต่อ IP
- ตรวจสถานะ `is_voting_open` ที่ **server ทุกครั้ง** ก่อนบันทึกโหวต
- ลบนักร้องแล้วคะแนนหายไปด้วย (CASCADE)
- รูปนักร้อง: รับเฉพาะ jpg / png / webp ไม่เกิน 5 MB ย่อให้กว้างสูงสุด 800 px แปลงเป็น webp และตั้งชื่อไฟล์ด้วย UUID

## API endpoints
| Method | Path | หมายเหตุ |
|---|---|---|
| GET | `/api/singers` | รายชื่อนักร้อง (สาธารณะ) |
| POST | `/api/singers/:id/vote` | โหวต ต้องมีสิทธิ์ตามกติกา |
| GET | `/api/settings/voting` | สถานะเปิด/ปิดโหวต |
| POST | `/api/admin/login` | ตั้ง httpOnly cookie |
| POST | `/api/admin/logout` | ลบ cookie |
| GET | `/api/admin/results` | นักร้องพร้อมคะแนนรวม (admin) |
| POST | `/api/admin/singers` | เพิ่มนักร้อง multipart (admin) |
| PUT | `/api/admin/singers/:id` | แก้ไขนักร้อง (admin) |
| DELETE | `/api/admin/singers/:id` | ลบนักร้อง (admin) |
| PATCH | `/api/admin/voting` | body `{ "open": true/false }` (admin) |

Error response ใช้รูปแบบเดียวกันเสมอ: `{ "error": "message" }`

## Security rules (ต้องทำทุกครั้ง)
- ตรวจสิทธิ์ admin ที่ middleware สำหรับทุก route ที่ขึ้นต้นด้วย `/api/admin/`
- Query ฐานข้อมูลด้วย prepared statement เท่านั้น ห้ามต่อ string ที่รับจากผู้ใช้เข้า SQL
- ห้ามใช้ `dangerouslySetInnerHTML` และห้ามใช้ `|safe` กับข้อมูลที่ผู้ใช้กรอก
- ตรวจชนิดไฟล์จาก magic bytes (ผ่าน sharp) ไม่ใช่จากนามสกุลอย่างเดียว
- ห้าม commit `.env` ให้มี `.env.example` แทน
- ไม่ hardcode รหัสผ่าน Admin สร้าง Admin คนแรกจาก `ADMIN_USERNAME` และ `ADMIN_PASSWORD` ใน env
- เปิด CORS เฉพาะ origin ของ frontend

## Mobile-first UI
- เขียน class ขนาดมือถือก่อน แล้วค่อยเพิ่ม `md:` / `lg:`
- ปุ่มโหวตสูงอย่างน้อย 44 px
- แสดง toast เมื่อโหวตสำเร็จ หรือเมื่อระบบปิดโหวตอยู่
- รูปนักร้องใช้ `loading="lazy"` และกำหนดขนาดกรอบไว้ล่วงหน้าเพื่อกัน layout shift

## Coding conventions
- Backend: `controllers → services → models` ห้ามเขียน SQL ใน controller
- Frontend: ใช้ function component และ hooks ห้ามเรียก `fetch` ตรงใน component
- ชื่อตัวแปร ฟังก์ชัน และ API ใช้ภาษาอังกฤษ ข้อความบน UI และ comment ใช้ภาษาไทยได้
- Error ฝั่ง server ต้องผ่าน error handler กลาง ไม่ส่ง stack trace ให้ client

## Development workflow
- ทำตาม PHASE ทีละ phase ตามลำดับนี้:
  1. Project setup และ schema (สร้างตารางและ seed admin)
  2. Backend API ของผู้ชม (รายชื่อ, โหวต, กติกาการโหวต)
  3. Backend API ของ Admin (login, CRUD นักร้อง, เปิด/ปิดโหวต, results)
  4. Frontend หน้าโหวตสำหรับผู้ชม (Mobile-first)
  5. Frontend หน้า Admin
  6. Test และ security review
  7. เตรียม deploy
- ห้ามข้ามไป phase ถัดไปโดยไม่แจ้งก่อน
- เขียน test สำหรับกติกาโหวต (โหวตซ้ำ, ปิดโหวต, rate limit) และ auth (เข้าหน้า admin โดยไม่ login)
- commit เล็ก ๆ และอธิบายสิ่งที่เปลี่ยนในแต่ละ commit
- เมื่อจบงานให้สรุปไฟล์ที่เปลี่ยน คำสั่งที่รัน และผล test

## Out of scope
- WebSocket / real-time
- ระบบสมาชิกแบบผู้ใช้ทั่วไป (มีเฉพาะ Admin)
- Library นอกเหนือจากรายการใน Tech stack ต้องถามก่อนเพิ่มทุกครั้ง