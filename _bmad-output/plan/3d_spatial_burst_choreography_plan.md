# Ke hoach kien truc 3D Spatial Burst Choreography & Direct Manipulation

Tai lieu nay xac dinh kien truc va lo trinh phat trien he thong **Thao tac truc tiep diem no va doi hinh phao hoa trong khong gian 3D (Direct 3D Spatial Manipulation)** cho FDShowStudio. Thay vi chi bien dao gian tiep qua bang so Property Inspector hoac thanh Timeline 2D, he thong cho phep nguoi dung quan sat, keo tha do cao no, huong ban va doi hinh phao truc tiep trong khung nhin Three.js 3D.

---

## 1. Muc tieu & Tam nhin Kien truc

- **Chuyen doi mo hinh bien dao**:
  - Tu **Timeline-Centric Editing** (chi nhap so va keo slider) sang **WYSIWYG 3D Spatial Choreography** (bien dao truc quan tren bau troi 3D).
- **Tuong tac truc quan hai chieu (Bidirectional Data Binding)**:
  - Thao tac Gizmo 3D lap tuc cap nhat tham so event (`burstHeight`, `sectorId`, `positionX`, `tiltAngle`).
  - Thay doi tren Timeline hoac Property Inspector lap tuc phan chieu vi tri Gizmo 3D.
- **Kiem soat vat ly an toan & Khong o nhiem Schema**:
  - Gioi han an toan cho do cao no: 50m - 300m (phu hop voi luc ban va trong luc).
  - Tu dong giai nguoc dong hoc dan dao: Cap nhat lai thoi gian bay $t_{lift}$ va vong doi 3 phase tren block Timeline.
  - Toan bo Gizmo, Ghost Sphere va duong giong la cac thuc the render phu (Editor Helpers), khong ghi vao file khao ban JSON xuat ra.

---

## 2. Lo trinh 3 Giai doan (3-Phase Roadmap)

### Giai doan 1 & 2: Single & Multi-Shell Formation Gizmo + Tilt Angle (Hoan tat)
- **Ghost Burst Spheres & Multi-Point Cluster**:
  - Khi block co `count = 1`: Hien thi 1 Ghost Sphere wireframe tai tam diem no.
  - Khi block co `count > 1` (fan, sweep, v-shape, crossfire,...): Hien thi toan bo tap hop cac diem no cua tat ca cac qua phao trong block.
  - Duong cong noi bien doi hinh (Formation Envelope Line) the hien hinh dang canh quat hoac duong quet tren bau troi.
  - Tap hop cac duong phong dan dao (Launch Trajectory Lines) noi tu vi tri be phong duoi mat nuoc len tung diem no.
- **Che do dieu khien kep (Altitude Translate & Tilt Rotate)**:
  - **Translate Mode (Phim W / Button Altitude)**: Gizmo khoa truc Y cho phep keo do cao no (50m - 300m), nang ha ca doi hinh dong bo.
  - **Rotate Mode (Phim E / Button Tilt Angle)**: Gizmo vong xoay truc Z cho phep xoay nghieng dan phao tu -80 do den +80 do, tu dong bat `useAngle = true` va dong bo sang Property Inspector.
- **Duong giong do cao & Badge thoi gian thuc**:
  - Floating Badge tren khong gian 3D hien thi thong so thoi gian thuc: `Height: Xm | Tilt: Y deg | Shots: N (pattern)`.
  - Tich hop 2 nut chuyen nhanh mode ngay tren badge va phim tat `W` / `E`.
- **Dong bo hai chieu & Undo/Redo**:
  - Tuong tac trong 3D lap tuc cap nhat `burstHeight`, `angle`, `useAngle`, dong bo sang TimelineEditor va PropertyInspector.
  - Tich hop lich su Undo/Redo (`saveHistoryState()`) va tu dong an khi show phat (`timeline:playback-started`).

### Giai doan 3: Deterministic Freeze-Frame Scrubbing (Dong bang hat 3D)
- **Scrubbing Simulation**:
  - Khi click hoac keo thanh kim Playhead toi bat ky giay nao trong block phao, engine thuc hien headless stepped simulation de dong bang dung trang thai hat phao (hat dang bung no hoac tan tro dang roi) tai frame do.
  - Ket hop dong thoi giua hat thuc te va Gizmo dieu khien de tao trai nghiem "dung hinh tua phao" nhu video Youtube.

---

## 3. Thiet ke Chi tiet Giai doan 1 (Single Burst Spatial Gizmo)

### Cau truc Module
```
src/
  editor/
    systems/
      BurstSpatialGizmo.js    # Module quan ly Gizmo, Ghost Sphere va duong giong do cao
tests/
  editor/
    BurstSpatialGizmo.test.js # Test suite kiem tra khoi tao, cap nhat do cao, clamping, va su kien
```

### Quy trinh Hoat dong (Execution Flow)
1. `BurstSpatialGizmo` duoc khoi tao trong `main.js` voi `scene`, `camera`, `renderer.domElement`, `orbitControls`.
2. Khi `TimelineEditor` phat su kien `timeline:selection-changed`:
   - Neu co 1 event phao hoa duoc chon: `BurstSpatialGizmo.show(event)`.
   - Tinh toan toa do no hien tai $(x, y, z)$ dua vao `sectorId`, `positionX`, va `burstHeight` (hoac `ratioY`).
   - Dat khoi cau ao wireframe va `TransformControls` tai vi tri no.
   - Neu khong co event phao hoa nao duoc chon: `BurstSpatialGizmo.hide()`.
3. Khi nguoi dung tuong tac voi Gizmo:
   - Su kien `dragging-changed = true`: Luu `saveHistoryState()` tren `TimelineEditor`.
   - Su kien `change` khi dang keo: Cap nhat `event.burstHeight = Math.round(clampedY)`.
   - Phat su kien dong bo de Timeline re-render do dai block va Property Inspector update input.
4. Khi Playback chay (`isPlaying = true`):
   - `BurstSpatialGizmo` tu dong an de giu khung canh trinh dien sach se.
   - Khi dung lai (Pause/Seek), tu dong hien thi lai neu dang co block duoc chon.
