# RoomReady

A React Native + Expo Go starter for exploring furniture layouts on a phone.

## Run on a phone

1. Install Node.js (LTS) and Expo Go on your iPhone or Android phone.
2. From this folder, run `npm install`.
3. Run `npx expo start` and scan the QR code with Expo Go. Your phone and computer should be on the same network. If the network blocks device discovery, run `npx expo start --tunnel`.

The room photo picker uses Expo Image Picker. Photos are held in app state as a local device URI and are not uploaded or persisted by this prototype.

## Current starter flow

- Home screen with a one-tap sample-room path.
- Room choice screen with sample room, camera, and photo-library entry points.
- Planner with an illustrative 2D room, demo furniture catalog, add/select/move/remove/reset controls, and an explicit catalog-connection placeholder.
- Furniture products and dimensions are illustrative demo data.
