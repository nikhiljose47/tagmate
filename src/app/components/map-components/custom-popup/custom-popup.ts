export class CustomPopup {
  private L: any;
  private map!: any;
  private container!: HTMLElement;
  private latlng!: any;

  constructor(L: any, latlng: any, content: string) {
    this.L = L;
    this.latlng = this.L.latLng(latlng);
    this.createContainer(content);
  }

  private createContainer(content: string) {
    this.container = this.L.DomUtil.create('div', 'custom-popup');
    this.container.innerHTML = content;

    this.L.DomEvent.disableClickPropagation(this.container);
    this.L.DomEvent.disableScrollPropagation(this.container);
  }

  addTo(map: any) {
    this.map = map;

    // put popup in overlayPane
    this.map.getPanes().overlayPane.appendChild(this.container);

    // update position immediately
    this.updatePosition();

    // update during move & zoom events
    this.map.on('move', () => this.updatePosition());
    this.map.on('zoom', () => this.updatePosition());
    this.map.on('zoomend', () => this.updatePosition());

    return this;
  }

  private updatePosition() {
    if (!this.map) return;

    // KEY FIX: use container point
    const pos = this.map.latLngToContainerPoint(this.latlng);

    this.container.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  }

  remove() {
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
