import { AfterViewInit, Component, OnDestroy, signal } from '@angular/core';
import markersData from '../../data/tags.json';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Utils } from '../../services/utils';
import { CommonModule } from '@angular/common';
import { SharedStateService } from '../../services/shared-state.service';

@Component({
  selector: 'app-tagmate',
  templateUrl: './tagmate.html',
  styleUrls: ['./tagmate.scss'],
  standalone: true,
  imports: [FormsModule, CommonModule]
})
export class Tagmate implements AfterViewInit, OnDestroy {
  private map: any;
  private L: any;
  private markerLayer!: L.LayerGroup;
  query = '';
  isSearching = signal(false);
  postMode = signal(false);
  countryMode = false;
  showInfo = false;
  selected: number = 7;

  constructor(private http: HttpClient, private utils: Utils, private state: SharedStateService) { }


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
      center: [12.952179272658608, 77.70078033997684],
      zoom: 16,
      scrollWheelZoom: false
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

    const circle = this.utils.drawCircle(12.952179272658608, 77.70078033997684, 2500, this.L);
    console.log('circle', circle);
    circle.addTo(this.map);


    markersData.forEach((m: any) => {
      m.iconName = 'alert';
      const icon = this.utils.getIcon(m.iconName || 'default', this.L);
      const marker = this.L.marker([m.lat, m.lng], { icon }).addTo(this.map);


      //  const popup = this.L.popup({ className: 'transparent-popup', autoClose: false, closeOnClick: false, closeButton: false }).setContent('<p>HI</p>');
      // marker.bindPopup(popup).openPopup();

      //       new CustomPopup(this.L,
      //         [m.lat, m.lng],
      //         `<div style="
      //   display:flex;
      //   flex-direction:column;
      //   justify-content:space-between;
      //   width:120px;
      //   height:55px;
      //   padding:6px 8px;
      //   border-radius:6px;
      //   box-shadow:0 1px 3px rgba(0,0,0,0.3);
      //   font-family:'Inter',sans-serif;
      //   background:#1e1e1e;
      //   color:#f1f1f1;
      // ">
      //   <div style="
      //     flex:2.2;
      //     font-size:12px;
      //     font-weight:600;
      //     color:#ffcc66;
      //     overflow:hidden;
      //     text-overflow:ellipsis;
      //     white-space:nowrap;
      //   ">
      //     ${m.highlight}
      //   </div>

      //   <div style="
      //     flex:0.8;
      //     display:flex;
      //     justify-content:space-between;
      //     align-items:center;
      //     font-size:10px;
      //   ">
      //     <div style="color:#bbb;">${m.username}</div>
      //     <div id="timer-${m.username}" style="color:#ffb84d;">⏳ ${m.expiresIn}s</div>
      //   </div>
      // </div>
      //   `
      //       ).addTo(this.map);



      // Timer logic
      let remaining = m.expiresIn;
      // const timerElement = popupDiv.querySelector(`#timer-${m.username}`)!;
      // const interval = setInterval(() => {
      //   remaining--;
      //   if (remaining <= 0) {
      //     timerElement.textContent = '⏱ Expired';
      //     clearInterval(interval);
      //   } else {
      //     timerElement.textContent = `⏳ ${remaining}s`;
      //   }
      // }, 1000);
    });

    // this.utils.startTimer(60, (s) => {
    //   var popup = this.L.popup([this.utils.getRandom(7, 15), this.utils.getRandom(65, 90)], { content: '<p>Hello world!<br />This is a nice popup.</p>' })
    //     .openOn(this.map);
    // }, () => { });

  }

  select(value: number) {
    this.map.setZoom(value)
  }


  search(): void {
    const q = this.query?.trim();
    if (!q) return;
    this.isSearching.set(true);
    // Nominatim API (OpenStreetMap) — polite usage: include `format=jsonv2` and optionally `email` param.
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}`;


    this.http.get<any[]>(url).subscribe({
      next: (res) => {
        this.isSearching.set(false);
        if (!res || res.length === 0) {
          alert('Location not found');
          return;
        }
        const first = res[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);


        // clear previous markers
        this.markerLayer.clearLayers();

        // custom icon
        const icon = this.utils.getIcon('loc-pin', this.L);

        // add draggable marker
        const m = this.L.marker([lat, lon], { icon, draggable: true }).addTo(this.markerLayer);

        // bind popup
        //  m.bindPopup(`${first.display_name}`).openPopup();

        // pan + zoom
        this.map.setView([lat, lon], 13);

        // 🧭 Listen to dragend event
        m.on('dragend', (event: any) => {
          const position = event.target.getLatLng();
          const { lat, lng } = position;
          console.log(`📍 Marker moved to: ${lat}, ${lng}`);
          this.state.updateCoordinates(lat, lng);

          // Reverse geocode to get address
          this.getAddressFromCoords(lat, lng);
        });

      },
      error: (err) => {
        this.isSearching.set(false);
        console.error('Geocoding error', err);
        alert('Geocoding failed');
      }
    });
  }

  getAddressFromCoords(lat: number, lon: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        const address = res.display_name || 'Unknown location';
        this.state.updateText(address);
        console.log(`📫 Address: ${address}`);

      },
      error: (err) => console.error('Reverse geocoding failed', err)
    });
  }


  ngOnDestroy() {
    if (this.map) this.map.remove();
  }
}
