# Sudoku Petualangan

Sudoku dengan 9 ikon petualangan (kompas, peta, ransel, sepatu, senter, korek api, teropong, pisau lipat, tenda).
Beranda hanya menampilkan rekor terbaik pemain untuk tiap tingkat kesulitan.

## Struktur file

```
index.html          halaman utama
style.css           desain (tanpa outline, gradasi sesuai palet)
game.js             logika sudoku, timer, peringkat
firebase-config.js  tempat menaruh konfigurasi Firebase
icons/              9 ikon SVG
```

## Langkah 1 - Coba di komputer

Buka terminal di folder ini, lalu jalankan `python3 -m http.server 8000` dan buka `http://localhost:8000`.
(Jangan klik dua kali index.html, karena modul JavaScript tidak jalan lewat `file://`.)
Tanpa Firebase, game berjalan di **mode lokal**: peringkat hanya tersimpan di browser sendiri.

## Langkah 2 - Buat peringkat bersama (Firebase, gratis)

GitHub Pages hanya menyajikan file statis, jadi peringkat bersama butuh database. Firebase Firestore paket gratis (Spark) cukup untuk ini.

1. Buka https://console.firebase.google.com lalu **Add project** (Google Analytics boleh dimatikan).
2. Menu **Build > Firestore Database > Create database**. Pilih lokasi terdekat (mis. `asia-southeast2` Jakarta), mulai dengan **production mode**.
3. Tab **Rules**, ganti isinya dengan aturan di bawah, lalu **Publish**.
4. Di **Project settings (ikon gerigi) > General > Your apps**, klik ikon web `</>`, beri nama app, lalu salin objek `firebaseConfig`.
5. Tempel nilainya ke `firebase-config.js` (gantikan semua yang berawalan `ISI_`).

Aturan Firestore (menyimpan rekor tiap pemain di koleksi `records`):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /records/{pid} {
      function ok(t) { return t == null || (t is int && t >= 20000 && t <= 86400000); }
      function valid() {
        let d = request.resource.data;
        return d.keys().hasOnly(['name','easy','medium','hard','pid','updatedAt'])
          && d.name is string && d.name.size() >= 2 && d.name.size() <= 16
          && ok(d.easy) && ok(d.medium) && ok(d.hard)
          && d.pid == pid && d.updatedAt == request.time;
      }
      allow read: if true;
      allow create, update: if valid();
      allow delete: if false;
    }
  }
}
```

Catatan: nilai `apiKey` Firebase untuk web memang boleh terlihat publik. Yang melindungi datamu adalah aturan di atas.

## Langkah 3 - Publikasikan ke github.io

1. Buat akun di https://github.com bila belum punya.
2. Buat repository baru (**New repository**). Untuk alamat `https://USERNAME.github.io/` beri nama persis `USERNAME.github.io`. Nama lain juga boleh, alamatnya jadi `https://USERNAME.github.io/NAMA-REPO/`. Pilih **Public**.
3. Unggah semua isi folder ini. Cara termudah: di halaman repo klik **Add file > Upload files**, seret semua file dan folder `icons`, lalu **Commit changes**.
   Atau lewat terminal:
   ```
   git init
   git add .
   git commit -m "Sudoku Petualangan"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```
4. Di repo: **Settings > Pages**. Pada **Build and deployment**, pilih **Source: Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
5. Tunggu 1-2 menit, lalu buka alamat yang muncul di halaman Pages tersebut.
6. Terakhir, di Firebase Console buka **Authentication > Settings > Authorized domains** dan pastikan `USERNAME.github.io` ada (hanya perlu bila nanti memakai Authentication).

## Cara kerja rekor

- Setiap permainan memakai teka-teki acak. Waktu tercepat per tingkat disimpan di browser pemain, dan disalin ke Firestore (nama + rekor) bila Firebase dipasang.
- Tanpa Firebase, rekor tetap jalan tapi hanya di browser itu.
- Data di Firestore bisa dipakai nanti bila ingin membuat halaman peringkat.

## Keterbatasan yang perlu kamu tahu

Karena tidak ada server sendiri, kecurangan tidak bisa dicegah sepenuhnya. Waktu dihitung di browser pemain, jadi orang yang paham bisa mengirim skor palsu. Aturan Firestore di atas hanya membatasi bentuk data (nama, rentang waktu minimal, satu skor per pemain). Bila nanti peringkat jadi serius (hadiah dll.), perlu server yang memverifikasi solusi.

## Mengubah tampilan

Warna ada di bagian `:root` pada `style.css`. Jumlah petunjuk awal tiap tingkat ada di konstanta `DIFFS` pada `game.js`.
