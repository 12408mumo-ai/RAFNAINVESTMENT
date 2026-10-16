# Rafna Investment
Responsive React storefront, WhatsApp checkout, and authenticated Express owner dashboard.

## Run
```sh
npm install
npm run dev
```
Open port 3000. The server binds to `0.0.0.0` and supports Arena preview hosts. The admin link opens `/admin`; the initial password is **Rafna2026!**. Change it using `ADMIN_PASSWORD` before publishing. The logo in both the login and header links back to the storefront.

Without Supabase settings, the app runs in clearly labelled local mode: sample products initialize in `data/products.json`, with uploaded photos in `uploads/`. These paths are ignored by Git; use a persistent disk or Supabase for production. Sample products use illustrative lifestyle photography; replace them with actual stock and confirmed prices in the dashboard.

## Connect Supabase
1. Create a Supabase project and run `supabase/setup.sql` in its SQL editor. This creates the products table and public `product-images` bucket (8 MB maximum).
2. Set server environment variables from `.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a strong `ADMIN_PASSWORD`. The service-role key must NEVER be exposed as a Vite/browser variable. Use your hosting provider's environment settings, or Node's `--env-file` support, for example `node --env-file=.env server.js`. The app does not load `.env` automatically.
3. Restart the server. The dashboard will use Supabase instead of local mode. It starts with your actual database products (not demo data).
4. Upload a photo or supply an HTTPS image URL, complete the product form, and publish. Uploads go to Supabase Storage first; the generated public URL is saved in `products`. Failed database inserts clean up the newly uploaded object. Deleting a product removes its database record; storage files are retained to avoid removing shared photos.
5. The shop reloads products after changes, when the window regains focus, and every 30 seconds for other open visitors.

## Production
```sh
npm run build
NODE_ENV=production ADMIN_PASSWORD='your-strong-password' COOKIE_SECURE=true npm start
```
Provide Supabase environment variables too. Use HTTPS and a persistent Node server, not static-only hosting. Login sessions are HTTP-only, same-site cookies lasting eight hours; restarting the server signs everyone out. Mutations require server authentication. Login attempts are rate limited. Origin checks protect authenticated mutations. For multiple server replicas, use a shared session/rate-limit store. No payment data is collected. Orders open WhatsApp with the required customer and product details; the customer must tap Send in WhatsApp. Country-wide delivery charges are agreed with the shop.

## Checks
`npm run build` compiles the frontend. `node --test test/server.test.js` verifies authentication, unauthorized access, product creation/deletion, file uploads, and logout against a running development server (default `http://localhost:3000`). Tests create then delete temporary products.
