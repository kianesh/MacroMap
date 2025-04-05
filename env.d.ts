declare module '@env' {
  export const GOOGLE_MAPS_API_KEY: string;
  export const FATSECRET_CLIENT_KEY: string;
  export const FATSECRET_CLIENT_SECRET: string;
  export const NUTRITIONIX_APP_ID: string;
  export const NUTRITIONIX_API_KEY: string;
  export const FIREBASE_API_KEY: string;
  export const FIREBASE_AUTH_DOMAIN: string;
  export const FIREBASE_PROJECT_ID: string;
  export const FIREBASE_STORAGE_BUCKET: string;
  export const FIREBASE_MESSAGING_SENDER_ID: string;
  export const FIREBASE_APP_ID: string;
  export const FIREBASE_MEASUREMENT_ID: string;
  export const GOOGLE_CUSTOM_SEARCH_API_KEY: string;
  export const GOOGLE_CUSTOM_SEARCH_ENGINE_ID: string;

}

declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_API_KEY: string;
    REACT_APP_API_URL: string;
    // Add other environment variables here
  }
}