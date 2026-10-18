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
    })
    .catch(error => console.error('Error al guardar el color:', error));
}

document.querySelectorAll('tbody tr').forEach(tr => {
  const selector = tr.querySelector('.selector-color');
  const quitar = tr.querySelector('.btn-quitar');

  selector.addEventListener('change', () => guardarColor(tr, selector.value));
  quitar.addEventListener('click', () => guardarColor(tr, ''));
});