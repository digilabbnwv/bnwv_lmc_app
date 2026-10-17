// Testopzet voor Vitest (jsdom).
// jsdom kent <dialog> wel, maar niet showModal() en close(). Deze minimale nabootsing zet
// alleen `open` en stuurt het close-event; focus vasthouden en inert maken doet in het echt
// de browser (gecontroleerd in de galerij).
const proto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
if (typeof proto.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
