# Full-screen reader, no interstitial, no visible link

## What changes for the member

1. **"Your batches are ready" page hataya ja raha hai.** Login ke baad Study tab kholte hi content seedha khulta hai — koi extra tap, koi rocket card, koi hand-pointer nahi.
2. **Full-screen reader.** Content pura screen leta hai: top header aur bottom nav reader ke andar hide, sirf ek chhota floating "Back" button (PW ARYA badge ke saath) upar-left me. Address wala koi strip visible nahi.
3. **Link kabhi expose nahi hota.** Abhi jab bot-check 2 baar fail hota hai to app browser ko asli address par bhej deti hai — wahi jagah hai jahan user ko poora link dikh jata hai aur naya browser page khulta hai. Ye external fallback hata diya jayega.
4. **Redirect advance kiya jayega** taki bot-check ke chances hi kam ho: same-origin par silent retries (exponential backoff, 3 attempts), retry ke beech branded PW ARYA loader — user ko lagta hai page load ho raha hai. Agar teeno attempts fail hon to ek "Retry" button dikhega jo phir se apne hi origin se try karega; kabhi bahar nahi bhejega.

## Technical notes

- `src/routes/dashboard.tsx`
  - `BatchLauncher` se landing card, `Rocket`/`Hand` UI aur `opening` state hata kar reader ko default state banana (`reader` initial `true` jab `portalToken` mila ho).
  - `pw-portal-fallback` message handler se `window.location.href = d.url` hata dena; uski jagah in-frame retry counter + branded fallback UI.
  - Reader mode me `Dashboard` layout ka header aur bottom nav chhupana (reader active flag `Dashboard` me lift karna), `main` ka `pb-20` reader me hata dena, iframe `fixed inset-0` full-screen.
  - Floating back button `absolute top-3 left-3 z-50`, semi-transparent — isse Study/Alerts/Profile nav wapas milta hai.
- `src/routes/api/portal/$.ts`
  - Challenge branch se `direct` URL aur `postMessage({url})` payload hata dena — ab sirf `{type:'pw-portal-fallback'}` bhejenge, koi address nahi (link leak band).
  - Retry limit 2 se 3, backoff 1.5s/3s/5s, aur retry request par `sec-fetch-site: same-origin` + rotating realistic UA header taki upstream check pass hone ke chances badhein.
- Kuch bhi backend/DB me nahi badalta; access rules, device-lock aur token logic waise ke waise.

## Limitation (honest note)

Agar upstream host baar-baar bot-check deta hai to bhi hum user ko bahar nahi bhejenge — us case me PW ARYA ke andar hi "Retry" screen dikhegi. Isse link kabhi visible nahi hoga, par kabhi-kabhi content khulne me extra kuch seconds lag sakte hain.
