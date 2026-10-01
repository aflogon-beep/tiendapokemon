// Avisos breves arriba de la pantalla (como toast() en la v10)
export function toast(html: string): void {
  let box = document.getElementById('toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast';
    document.body.appendChild(box);
  }
  const d = document.createElement('div');
  d.className = 'toast';
  d.innerHTML = html;
  box.appendChild(d);
  while (box.children.length > 3) box.firstChild?.remove();
  setTimeout(() => d.remove(), 2600);
}
