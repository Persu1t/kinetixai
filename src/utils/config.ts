export const MODE = (process.env.NEXT_PUBLIC_MODE || "PROD").toUpperCase();
export const IS_FAIR = MODE === "FAIR";
export const IS_PROD = MODE === "PROD";