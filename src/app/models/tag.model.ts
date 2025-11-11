export interface Tag {
    username: string;
    userId: string;
    highlight: string;
    lat: number;
    lng: number;
    expiresIn: number;
    tag: string;
    createdAt: string; // ISO timestamp
    images: string[];  // array of image URLs
}
