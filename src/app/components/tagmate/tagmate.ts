import { AfterViewInit, Component, contentChild, OnDestroy } from '@angular/core';
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

  countryMode = false;
showInfo = false;



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
    // const DefaultIcon = L.icon({
    //   iconRetinaUrl,
    //   iconUrl,
    //   shadowUrl,
    //   iconSize: [3, 4],
    //   iconAnchor: [12, 41],
    //   popupAnchor: [1, -34],
    //   shadowSize: [41, 41],
    // });
    // L.Marker.prototype.options.icon = this.utils.getIcon('alert', L) ;
    L.Marker.prototype.options.autoPan = false;

    // Initialize map
    this.map = L.map('map', {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href=https://www.openstreetmap.org/copyright>OpenStreetMap</a> contributors'
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
      m.iconName = 'alert';
      const icon = this.utils.getIcon(m.iconName || 'default', this.L);

      const marker = this.L.marker([m.lat, m.lng], { icon }).addTo(this.map);

      // Create popup HTML
      const popupDiv = document.createElement('div');
      popupDiv.innerHTML = `
 <div style="
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  width:120px;
  height:55px;
  padding:6px 8px;
  border-radius:6px;
  box-shadow:0 1px 3px rgba(0,0,0,0.3);
  font-family:'Inter',sans-serif;
  background:#1e1e1e;
  color:#f1f1f1;
">
  <div style="
    flex:2.2;
    font-size:12px;
    font-weight:600;
    color:#ffcc66;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  ">
    ${m.highlight}
  </div>

  <div style="
    flex:0.8;
    display:flex;
    justify-content:space-between;
    align-items:center;
    font-size:10px;
  ">
    <div style="color:#bbb;">${m.username}</div>
    <div id="timer-${m.username}" style="color:#ffb84d;">⏳ ${m.expiresIn}s</div>
  </div>
</div>
  `;

      const popup = this.L.popup({ className: 'transparent-popup', autoClose: false, closeOnClick: false }).setContent(popupDiv);
      marker.bindPopup(popup).openPopup();

      // Timer logic
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
