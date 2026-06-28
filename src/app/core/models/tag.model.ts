export interface Tag {
  id?: string;
  username: string;
  userId: string;
  highlight: string;
  lat: number;
  lng: number;
  expiresIn: number;
  tag: string;
  createdAt: string;
  images: string[];
  hoodId?: string;
  country?: string;
}
