(() => {
  const MAX_BYTES = 2 * 1024 * 1024;  
  const LIMITE_FILAS = 200;            
  const REQUERIDAS = ['orden', 'fecha', 'codigo', 'producto', 'cliente', 'tipo', 'cantidad'];
  const TEXTO_INICIAL = 'Ningún archivo seleccionado (formato .csv)';
  const normalizar = (t) =>
    (t ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  function detectarSeparador(texto) {
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 5);
    const cuentas = { ';': 0, ',': 0, '\t': 0 };
    for (const linea of lineas) {
      for (const ch of linea) {
        if (ch in cuentas) cuentas[ch]++;
      }
    }
    return Object.entries(cuentas).sort((a, b) => b[1] - a[1])[0][0];
  }
  function parsearCSV(texto, sep) {
    const filas = [];
    let fila = [];
    let celda = '';
    let entreComillas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (entreComillas) {
        if (c === '"') {
          if (texto[i + 1] === '"') { celda += '"'; i++; }
          else entreComillas = false;
        } else {
          celda += c;
        }
      } else if (c === '"') {
        entreComillas = true;
      } else if (c === sep) {
        fila.push(celda);
        celda = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        fila.push(celda);
        celda = '';
        filas.push(fila);
        fila = [];
      } else {
        celda += c;
      }
    }
    if (celda !== '' || fila.length) {
      fila.push(celda);
      filas.push(fila);
    }
    return filas;
  }

  const esFechaValida = (v) =>
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v);

  const form = document.getElementById('form-subida');
  const input = document.getElementById('archivo');
  const btnSubir = document.getElementById('btn-subir');
  const nombreArchivo = document.getElementById('nombre-archivo');
  const resumen = document.getElementById('resumen');
  const avisos = document.getElementById('avisos');
  const vista = document.getElementById('vista-previa');
  const tabla = document.getElementById('tabla-previa');
  const acciones = document.getElementById('acciones');
  const btnConfirmar = document.getElementById('btn-confirmar');
  const btnCancelar = document.getElementById('btn-cancelar');
  if (!form || !input || !tabla) return;

  function limpiar() {
    input.value = '';
    nombreArchivo.textContent = TEXTO_INICIAL;
    resumen.hidden = true;
    resumen.textContent = '';
    avisos.hidden = true;
    avisos.replaceChildren();
    vista.hidden = true;
    tabla.querySelector('thead').replaceChildren();
    tabla.querySelector('tbody').replaceChildren();
    acciones.hidden = true;
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = 'Confirmar y subir';
  }

  function mostrarAvisos(lista) {
    avisos.replaceChildren();
    lista.forEach(({ tipo, texto }) => {
      const d = document.createElement('div');
      d.className = 'aviso ' + tipo;
      d.textContent = texto;
      avisos.appendChild(d);
    });
    avisos.hidden = lista.length === 0;
  }

  function rechazar(texto) {
    limpiar();
    mostrarAvisos([{ tipo: 'error', texto }]);
  }

  btnSubir.addEventListener('click', () => input.click());
  btnCancelar.addEventListener('click', limpiar);
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) limpiar();
  });

  input.addEventListener('change', async () => {
    const archivo = input.files[0];
    if (!archivo) return;

    if (!archivo.name.toLowerCase().endsWith('.csv')) {
      rechazar('Solo se aceptan archivos .csv. En Excel: Archivo > Guardar como > "CSV UTF-8 (delimitado por comas)", y vuelve a elegirlo.');
      return;
    }
    if (archivo.size > MAX_BYTES) {
      rechazar('El archivo pesa más de 2 MB. Revisa que sea la programación correcta.');
      return;
    }
    const buffer = await archivo.arrayBuffer();
    let texto = new TextDecoder('utf-8').decode(buffer);
    if (texto.includes('\uFFFD')) {
      texto = new TextDecoder('windows-1252').decode(buffer);
    }
    texto = texto.replace(/^\uFEFF/, '');

    const sep = detectarSeparador(texto);
    const filas = parsearCSV(texto, sep)
      .map((f) => f.map((c) => c.trim()))
      .filter((f) => f.some((c) => c !== ''));

    if (filas.length < 2) {
      rechazar('El archivo no tiene datos para mostrar.');
      return;
    }
    let iEnc = filas.findIndex((f) => f.some((c) => normalizar(c) === 'orden'));
    if (iEnc === -1) iEnc = 0;
    const encabezados = filas[iEnc];
    const datos = filas.slice(iEnc + 1);
    const normEnc = encabezados.map(normalizar);

    const faltan = REQUERIDAS.filter((r) => !normEnc.some((h) => h.includes(r)));
    const iOrden = normEnc.findIndex((h) => h.includes('orden'));
    const iCantidad = normEnc.findIndex((h) => h.includes('cantidad'));
    const colsFecha = normEnc
      .map((h, i) => (h.includes('fecha') || h.includes('fehca') ? i : -1))
      .filter((i) => i >= 0);
    const thead = tabla.querySelector('thead');
    const trHead = document.createElement('tr');
    ['#', ...encabezados.map((h, i) => h || 'col ' + (i + 1))].forEach((h) => {
      const th = document.createElement('th');
      th.textContent = h;
      trHead.appendChild(th);
    });
    thead.replaceChildren(trHead);
    const tbody = tabla.querySelector('tbody');
    tbody.replaceChildren();
    let sinOrden = 0;
    let celdasDudosas = 0;

    datos.forEach((r, i) => {
      const celdas = encabezados.map((_, c) => r[c] ?? '');
      const filaSinOrden = iOrden >= 0 && celdas[iOrden] === '';
      if (filaSinOrden) sinOrden++;

      const dudosas = celdas.map((v, c) => {
        if (v === '') return false;
        if (colsFecha.includes(c)) return !esFechaValida(v);
        if (c === iCantidad) return !/^[\d.,\s]+$/.test(v);
        return false;
      });
      celdasDudosas += dudosas.filter(Boolean).length;

      if (i < LIMITE_FILAS) {
        const tr = document.createElement('tr');
        if (filaSinOrden) tr.className = 'fila-error';
        const tdNum = document.createElement('td');
        tdNum.className = 'col-num';
        tdNum.textContent = i + 1;
        tr.appendChild(tdNum);
        celdas.forEach((v, c) => {
          const td = document.createElement('td');
          td.textContent = v;
          if (dudosas[c]) td.className = 'celda-error';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
    });
    const nombreSep = { ';': 'punto y coma', ',': 'coma', '\t': 'tabulación' }[sep];
    nombreArchivo.textContent = archivo.name;
    resumen.textContent =
      `${archivo.name} · ${(archivo.size / 1024).toFixed(1)} KB · ` +
      `${datos.length} filas de datos · ${encabezados.length} columnas · separador: ${nombreSep}`;
    resumen.hidden = false;

    const lista = [];
    if (faltan.length) {
      lista.push({ tipo: 'error', texto: 'Faltan columnas obligatorias: ' + faltan.join(', ') + '.' });
    }
    if (sinOrden) {
      lista.push({ tipo: 'error', texto: `${sinOrden} fila(s) sin número de orden (marcadas en rojo).` });
    }
    if (celdasDudosas) {
      lista.push({
        tipo: 'advertencia',
        texto: `${celdasDudosas} celda(s) con fecha o cantidad dudosa (marcadas en amarillo). Revísalas antes de subir.`
      });
    }
    if (datos.length > LIMITE_FILAS) {
      lista.push({
        tipo: 'advertencia',
        texto: `Se muestran las primeras ${LIMITE_FILAS} filas de ${datos.length}. Al confirmar se subirán todas.`
      });
    }
    mostrarAvisos(lista);

    vista.hidden = false;
    acciones.hidden = false;
    btnConfirmar.disabled = faltan.length > 0 || sinOrden > 0 || datos.length === 0;
  });
  document.addEventListener('submit', (e) => {
    if (e.target !== form) return;
    e.stopPropagation();

    if (btnConfirmar.disabled) {   
      e.preventDefault();
      return;
    }
    btnConfirmar.disabled = true;  
    btnConfirmar.textContent = 'Subiendo...';
  }, true);
})();