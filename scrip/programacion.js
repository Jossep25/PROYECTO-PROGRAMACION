const PRIORIDAD = ['rojo', 'naranja', 'amarillo', 'verde', 'azul', 'morado', 'gris'];
function familiaDeColor(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 'gris';
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.08) return 'gris'; 
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 345) return 'rojo';
  if (h < 45) return 'naranja';
  if (h < 70) return 'amarillo';
  if (h < 170) return 'verde';
  if (h < 260) return 'azul';
  return 'morado';
}

function guardarColor(tr, color) {
  const datos = new FormData();
  datos.append('id', tr.dataset.id);
  datos.append('color', color);

  fetch('conexionbd/colorconexionbd.php', { method: 'POST', body: datos })
    .then(respuesta => respuesta.text())
    .then(texto => {
      console.log('Respuesta del servidor:', texto);
      const res = JSON.parse(texto);
      if (!res.ok) {
        console.error('El servidor rechazó el color');
        return;
      }
      if (color) {
        tr.style.setProperty('--resalte', color);
        tr.classList.add('resaltado');
      } else {
        tr.style.removeProperty('--resalte');
        tr.classList.remove('resaltado');
      }
      ordenarFilas();
    })
    .catch(error => console.error('Error al guardar el color:', error));
}

function ordenarFilas() {
  const tbody = document.querySelector('tbody');
  if (!tbody) return;
  const filas = [...tbody.querySelectorAll('tr[data-id]')];
  const colorDe = (tr) =>
    tr.classList.contains('resaltado') ? tr.style.getPropertyValue('--resalte').trim() : '';
  const rango = (color) => {
    const i = PRIORIDAD.indexOf(familiaDeColor(color));
    return i === -1 ? PRIORIDAD.length : i;
  };

  filas.sort((a, b) => {
    const ca = colorDe(a);
    const cb = colorDe(b);
    if (!ca !== !cb) return ca ? -1 : 1;        
    if (ca !== cb) {
      const ra = rango(ca);
      const rb = rango(cb);
      if (ra !== rb) return ra - rb;                    
      return ca < cb ? -1 : 1;                          
    }
    return a.cells[0].textContent.localeCompare(b.cells[0].textContent, undefined, { numeric: true });
  });
  filas.forEach((tr) => tbody.appendChild(tr));
}

document.querySelectorAll('tbody tr').forEach(tr => {
  const selector = tr.querySelector('.selector-color');
  const quitar = tr.querySelector('.btn-quitar');

  if (!selector || !quitar) return;

  selector.addEventListener('change', () => guardarColor(tr, selector.value));
  quitar.addEventListener('click', () => guardarColor(tr, ''));
});

ordenarFilas();

const campoFecha = document.querySelector('.filtro-fecha input[type="date"]');

if (campoFecha) {
  const valorInicial = campoFecha.value;
  let escribiendo = false;

  campoFecha.addEventListener('pointerdown', () => {
    escribiendo = false;
  });

  campoFecha.addEventListener('change', () => {
    if (!escribiendo) campoFecha.form.submit();
  });

  campoFecha.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      campoFecha.form.submit();
    } else {
      escribiendo = true;
    }
  });

  campoFecha.addEventListener('blur', () => {
    if (escribiendo && campoFecha.value && campoFecha.value !== valorInicial) {
      campoFecha.form.submit();
    }
    escribiendo = false;
  });
}