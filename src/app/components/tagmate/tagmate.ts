import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import markersData from '../../data/tags.json';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TagExplorer } from '../tag-explorer/tag-explorer';
import { Utils } from '../../services/utils';

@Component({
  selector: 'app-tagmate',
  templateUrl: './tagmate.html',
  styleUrls: ['./tagmate.scss'],
  standalone: true,
  imports: [TagExplorer, FormsModule]
})
export class Tagmate implements AfterViewInit, OnDestroy {
  private map: any;
  private L: any;
  private markerLayer!: L.LayerGroup;
  public query = '';
  public loading = false;

  constructor(private http: HttpClient, private utils: Utils) { }

  async ngAfterViewInit(): Promise<void> {
    if (typeof window === 'undefined') return; // Skip SSR

    const leaflet = await import('leaflet');
    const L = leaflet.default ?? leaflet;
    this.L = L;

    // ✅ Fix broken default marker icons
    const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
    const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
    const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
    const DefaultIcon = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [9, 13],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
    L.Marker.prototype.options.icon = DefaultIcon;
    L.Marker.prototype.options.autoPan = false;

    // Initialize map
    this.map = L.map('map', {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB'
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);


    // Optional: press Enter in input to search
    const input = document.getElementById('geo-search-input') as HTMLInputElement | null;
    if (input) {
      input.addEventListener('keyup', (e) => {
        if (e instanceof KeyboardEvent && e.key === 'Enter') this.search();
      });
    }
    this.utils.setAllCards(markersData);
    this.utils.startRandomPopup(3000); // every 3s add one
    this.loadMarkers();
  }

  loadMarkers() {
    this.L.FeatureGroup.include({
      openPopup: function (popup: any) {
        if (popup && !popup.isOpen()) popup.openOn(this._map);
      }
    });

    markersData.forEach((m: any) => {
      const marker = this.L.marker([m.lat, m.lng]).addTo(this.map);

      // Custom popup HTML
      const popupDiv = document.createElement('div');
      popupDiv.innerHTML = `
  <div style="
    background:#1e1e1e;
    color:#f1f1f1;
    padding:6px 8px;
    border-radius:8px;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);
    font-family:'Inter',sans-serif;
    width:100px;
  ">
    <div style="font-weight:600;font-size:12px;">${m.username}</div>
    <div style="font-size:11px;color:#bbb;margin-top:2px;">${m.highlight}</div>
    <div id="timer-${m.username}" style="margin-top:4px;font-size:11px;color:#ffb84d;">
      ⏳ ${m.expiresIn}s
    </div>
    <input id="input-${m.username}"
      placeholder="Add text..."
      style="
        width:100%;
        border:1px solid #444;
        border-radius:4px;
        background:#2a2a2a;
        color:#f1f1f1;
        font-size:11px;
      "
    />
  </div>
`;


      // ✅ Create popup with option to not auto-close
      const popup = this.L.popup({ autoClose: false, closeOnClick: false }).setContent(popupDiv);
      marker.bindPopup(popup).openPopup();

      // Timer
      let remaining = m.expiresIn;
      const timerElement = popupDiv.querySelector(`#timer-${m.username}`)!;
      const interval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          timerElement.textContent = '⏱ Expired';
          clearInterval(interval);
        } else {
          timerElement.textContent = `⏳ ${remaining}s`;
        }
      }, 1000);
    });
  }

  search(): void {
    const q = this.query?.trim();
    if (!q) return;
    this.loading = true;
    // Nominatim API (OpenStreetMap) — polite usage: include `format=jsonv2` and optionally `email` param.
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}`;


    this.http.get<any[]>(url).subscribe({
      next: (res) => {
        this.loading = false;
        if (!res || res.length === 0) {
          alert('Location not found');
          return;
        }
        const first = res[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);


        // clear previous markers
        this.markerLayer.clearLayers();


        // add marker and popup
        const m = this.L.marker([lat, lon]);
        m.bindPopup(`${first.display_name}`).openPopup();
        m.addTo(this.markerLayer);


        // pan + zoom to location (zoom dependent on result importance)
        this.map.setView([lat, lon], 13);
      },
      error: (err) => {
        this.loading = false;
        console.error('Geocoding error', err);
        alert('Geocoding failed');
      }
    });
  }

  ngOnDestroy() {
    if (this.map) this.map.remove();
  }
}
