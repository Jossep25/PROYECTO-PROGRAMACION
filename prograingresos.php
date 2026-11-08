<?php
session_start();

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILAS = 5000;
const MAX_DETALLES = 20;
function terminar(bool $ok, string $mensaje, array $detalles = [], array $fechas = []): never
{
    $_SESSION['resultado_importacion'] = [
        'ok' => $ok,
        'mensaje' => $mensaje,
        'detalles' => $detalles,
        'fechas' => $fechas,
    ];
    header('Location: prograingresos.php');
    exit;
}

function normalizar(string $t): string
{
    $t = mb_strtolower(trim($t), 'UTF-8');
    return strtr($t, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
    ]);
}
function detectarSeparador(string $texto): string
{
    $lineas = array_filter(preg_split('/\r\n|\n|\r/', $texto), fn($l) => trim($l) !== '');
    $lineas = array_slice($lineas, 0, 5);
    $cuentas = [';' => 0, ',' => 0, "\t" => 0];
    foreach ($lineas as $linea) {
        foreach (array_keys($cuentas) as $sep) {
            $cuentas[$sep] += substr_count($linea, $sep);
        }
    }
    arsort($cuentas);
    return (string) array_key_first($cuentas);
}

function buscarColumna(array $encabezados, callable $criterio, array $excluir = []): ?int
{
    foreach ($encabezados as $i => $h) {
        if (!in_array($i, $excluir, true) && $criterio($h)) {
            return $i;
        }
    }
    return null;
}
function convertirFecha(string $v): string|null|false
{
    if ($v === '') {
        return null;
    }
    if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/', $v, $m)) {
        $dia = (int) $m[1];
        $mes = (int) $m[2];
        $anio = (int) $m[3];
    } elseif (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $v, $m)) {
        $anio = (int) $m[1];
        $mes = (int) $m[2];
        $dia = (int) $m[3];
    } else {
        return false;
    }
    if (!checkdate($mes, $dia, $anio)) {
        return false;
    }
    return sprintf('%04d-%02d-%02d', $anio, $mes, $dia);
}
function convertirEntero(string $v): int|null|false
{
    if ($v === '') {
        return null;
    }
    $v = str_replace(' ', '', $v);
    if (preg_match('/^\d+$/', $v)) {
        return (int) $v;
    }
    if (preg_match('/^\d{1,3}([.,]\d{3})+$/', $v)) {   
        return (int) preg_replace('/[.,]/', '', $v);
    }
    return false;
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require 'conexionbd/conexion.php';
    $desdeExcel = isset($_POST['csv_texto']);
    $colores = [];

    if ($desdeExcel) {
        $contenido = (string) $_POST['csv_texto'];
        if (strlen($contenido) > MAX_BYTES) {
            terminar(false, 'El archivo pesa más de 2 MB.');
        }
        $decodificados = json_decode((string) ($_POST['colores'] ?? '[]'), true);
        $colores = is_array($decodificados) ? $decodificados : [];
    } else {
        $archivo = $_FILES['archivo'] ?? null;
        if (!$archivo || $archivo['error'] !== UPLOAD_ERR_OK) {
            $demasiadoGrande = $archivo && in_array($archivo['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
            terminar(false, $demasiadoGrande
                ? 'El archivo es demasiado grande.'
                : 'No se pudo recibir el archivo. Vuelve a intentarlo.');
        }
        if (strtolower(pathinfo($archivo['name'], PATHINFO_EXTENSION)) !== 'csv') {
            terminar(false, 'Solo se aceptan archivos .xlsx o .csv.');
        }
        if ($archivo['size'] > MAX_BYTES) {
            terminar(false, 'El archivo pesa más de 2 MB.');
        }
        if (!is_uploaded_file($archivo['tmp_name'])) {
            terminar(false, 'No se pudo leer el archivo recibido.');
        }
        $contenido = file_get_contents($archivo['tmp_name']);
    }
    $contenido = preg_replace('/^\xEF\xBB\xBF/', '', $contenido);        
    if (!mb_check_encoding($contenido, 'UTF-8')) {
        $contenido = mb_convert_encoding($contenido, 'UTF-8', 'Windows-1252');
    }

    $separador = detectarSeparador($contenido);
    $flujo = fopen('php://temp', 'r+');
    fwrite($flujo, $contenido);
    rewind($flujo);

    $filas = [];
    while (($f = fgetcsv($flujo, 0, $separador, '"', '')) !== false) {
        $f = array_map(fn($c) => trim((string) $c), $f);
        if (count(array_filter($f, fn($c) => $c !== '')) === 0) {
            continue;   
        }
        $filas[] = $f;
    }
    fclose($flujo);
    $iEnc = null;
    foreach ($filas as $i => $f) {
        foreach ($f as $celda) {
            if (normalizar($celda) === 'orden') {
                $iEnc = $i;
                break 2;
            }
        }
    }
    if ($iEnc === null) {
        terminar(false, 'No encontré la fila de encabezados: debe existir una columna "orden".');
    }

    $encabezados = array_map('normalizar', $filas[$iEnc]);
    $datos = array_slice($filas, $iEnc + 1);

    if (count($datos) === 0) {
        terminar(false, 'El archivo no tiene filas de datos.');
    }
    if (count($datos) > MAX_FILAS) {
        terminar(false, 'El archivo tiene más de ' . MAX_FILAS . ' filas.');
    }
    $esFecha = fn(string $h): bool => str_contains($h, 'fecha') || str_contains($h, 'fehca');

    $cols = [
        'orden'    => buscarColumna($encabezados, fn($h) => str_contains($h, 'orden')),
        'codigo'   => buscarColumna($encabezados, fn($h) => str_contains($h, 'codigo')),
        'producto' => buscarColumna($encabezados, fn($h) => str_contains($h, 'producto')),
        'cliente'  => buscarColumna($encabezados, fn($h) => str_contains($h, 'cliente')),
        'tipo'     => buscarColumna($encabezados, fn($h) => str_contains($h, 'tipo')),
        'cantidad' => buscarColumna($encabezados, fn($h) => str_contains($h, 'cantidad')),
        'limite'   => buscarColumna($encabezados, fn($h) => $esFecha($h) && (str_contains($h, 'area') || str_contains($h, 'limite'))),
        'obs'      => buscarColumna($encabezados, fn($h) => str_contains($h, 'observ')),
    ];
    $cols['fecha'] = buscarColumna($encabezados, $esFecha, [$cols['limite']]);

    $faltan = [];
    foreach (['orden', 'fecha', 'codigo', 'producto', 'cliente', 'tipo', 'cantidad'] as $obligatoria) {
        if ($cols[$obligatoria] === null) {
            $faltan[] = $obligatoria;
        }
    }
    if ($faltan) {
        terminar(false, 'Faltan columnas obligatorias: ' . implode(', ', $faltan) . '.');
    }
    $maximos = ['orden' => 50, 'codigo' => 50, 'producto' => 100, 'cliente' => 100, 'tipo' => 50];
    $errores = [];
    $lote = [];
    $vistos = [];
    $fechasUsadas = [];

    foreach ($datos as $n => $fila) {
        $num = $n + 1;  
        $leer = fn(string $clave): string => $cols[$clave] === null ? '' : ($fila[$cols[$clave]] ?? '');

        $orden = $leer('orden');
        if ($orden === '') {
            $errores[] = "Fila $num: falta el número de orden.";
            continue;
        }
        $etiqueta = "Fila $num (orden $orden)";

        $fecha = convertirFecha($leer('fecha'));
        if ($fecha === null) {
            $errores[] = "$etiqueta: falta la fecha de producción.";
        } elseif ($fecha === false) {
            $errores[] = "$etiqueta: fecha de producción no válida (\"" . $leer('fecha') . '").';
        }

        $limite = convertirFecha($leer('limite'));
        if ($limite === false) {
            $errores[] = "$etiqueta: fecha límite no válida (\"" . $leer('limite') . '").';
        }

        $cantidad = convertirEntero($leer('cantidad'));
        if ($cantidad === false) {
            $errores[] = "$etiqueta: cantidad no válida (\"" . $leer('cantidad') . '").';
        }

        $colorFila = $desdeExcel ? ($colores[$n] ?? null) : null;
        $colorFila = (is_string($colorFila) && preg_match('/^#[0-9a-fA-F]{6}$/', $colorFila))
            ? strtolower($colorFila)
            : null;

        $r = [
            'orden'    => $orden,
            'fecha'    => $fecha,
            'codigo'   => $leer('codigo') === '' ? null : $leer('codigo'),
            'producto' => $leer('producto'),
            'cliente'  => $leer('cliente'),
            'tipo'     => $leer('tipo'),
            'cantidad' => $cantidad,
            'limite'   => $limite,
            'obs'      => $leer('obs') === '' ? null : $leer('obs'),
            'color'    => $colorFila,
        ];

        foreach ($maximos as $campo => $max) {
            if (mb_strlen((string) $r[$campo]) > $max) {
                $errores[] = "$etiqueta: el campo $campo es demasiado largo (máximo $max caracteres).";
            }
        }
        if (is_string($fecha)) {
            $clave = $orden . '|' . ($r['codigo'] ?? '') . '|' . $fecha;
            if (isset($vistos[$clave])) {
                $errores[] = "$etiqueta: está repetida (igual que la fila {$vistos[$clave]}).";
            } else {
                $vistos[$clave] = $num;
            }
            $fechasUsadas[$fecha] = true;
        }

        $lote[] = $r;
    }

    if ($errores) {
        $detalles = array_slice($errores, 0, MAX_DETALLES);
        if (count($errores) > MAX_DETALLES) {
            $detalles[] = '... y ' . (count($errores) - MAX_DETALLES) . ' problema(s) más.';
        }
        terminar(false, 'No se guardó nada: hay ' . count($errores) . ' problema(s) en el archivo.', $detalles);
    }
    $nuevas = 0;
    $actualizadas = 0;
    $conColor = count(array_filter($lote, fn($r) => $r['color'] !== null));

    try {
        $conexion->begin_transaction();

        $buscar = $conexion->prepare(
            "SELECT id FROM ordenes WHERE orden = ? AND fecha_produccion = ? AND codigo <=> ? LIMIT 1"
        );
        $insertar = $conexion->prepare(
            "INSERT INTO ordenes
                (orden, fecha_produccion, codigo, producto, cliente, tipo, cantidad, fecha_limite_area2, observacion, color)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $actualizar = $conexion->prepare(
            $desdeExcel
                ? "UPDATE ordenes
                      SET producto = ?, cliente = ?, tipo = ?, cantidad = ?, fecha_limite_area2 = ?, observacion = ?, color = ?
                    WHERE id = ?"
                : "UPDATE ordenes
                      SET producto = ?, cliente = ?, tipo = ?, cantidad = ?, fecha_limite_area2 = ?, observacion = ?
                    WHERE id = ?"
        );

        foreach ($lote as $r) {
            $buscar->bind_param('sss', $r['orden'], $r['fecha'], $r['codigo']);
            $buscar->execute();
            $resultado = $buscar->get_result();
            $existente = $resultado->fetch_assoc();
            $resultado->free();

            if ($existente) {
                $id = (int) $existente['id'];
                if ($desdeExcel) {
                    $actualizar->bind_param(
                        'sssisssi',
                        $r['producto'], $r['cliente'], $r['tipo'], $r['cantidad'], $r['limite'], $r['obs'], $r['color'], $id
                    );
                } else {
                    $actualizar->bind_param(
                        'sssissi',
                        $r['producto'], $r['cliente'], $r['tipo'], $r['cantidad'], $r['limite'], $r['obs'], $id
                    );
                }
                $actualizar->execute();
                $actualizadas++;
            } else {
                $insertar->bind_param(
                    'ssssssisss',
                    $r['orden'], $r['fecha'], $r['codigo'], $r['producto'], $r['cliente'],
                    $r['tipo'], $r['cantidad'], $r['limite'], $r['obs'], $r['color']
                );
                $insertar->execute();
                $nuevas++;
            }
        }

        $conexion->commit();
    } catch (Throwable $e) {
        $conexion->rollback();
        error_log('prograingresos.php (importar): ' . $e->getMessage());
        terminar(false, 'Ocurrió un error al guardar en la base de datos. No se guardó nada.');
    }

    $fechas = array_keys($fechasUsadas);
    sort($fechas);

    terminar(
        true,
        'Programación subida con éxito.',
        [count($lote) . " fila(s) guardadas ($nuevas nueva(s), $actualizadas actualizada(s))."
            . ($desdeExcel ? " Filas con color: $conColor." : '')],
        array_slice($fechas, 0, 5)
    );
}
$resultado = $_SESSION['resultado_importacion'] ?? null;
unset($_SESSION['resultado_importacion']);
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ingresos de programacion</title>
    <link rel="stylesheet" href="style/styleingresos.css">
</head>
<body>
    <aside class="sidebar-left">
        <div class="sidebar-logo">
        YO<span>VEGETA</span>
        </div>
        <ul class="sidebar-menu">
            <li><a href="principal.html">🐾<span>Inicio</span></a></li>
            <li><a href="programacion.php">📃<span>Programacion</span></a></li>
            <li><a href="#">⬆<span>Ingresos</span></a></li>
            <li><a href="prograingresos.php" class="active">📃<span>Ingresos de Programacion</span></a></li>
        </ul>
        <div class="sidebar-footer">
        <a href="login.html" class="logout-link">✖︎<span>Salir</span></a>
        </div>
    </aside>

    <main class="main-content">
        <h1>Ingresos de programacion</h1>

        <?php if ($resultado): ?>
        <div class="avisos">
            <div class="aviso <?= $resultado['ok'] ? 'ok' : 'error' ?>">
                <strong class="aviso-titulo"><?= $resultado['ok'] ? '✔' : '✖' ?> <?= htmlspecialchars($resultado['mensaje']) ?></strong>
                <?php if (!empty($resultado['detalles'])): ?>
                    <ul>
                        <?php foreach ($resultado['detalles'] as $detalle): ?>
                            <li><?= htmlspecialchars($detalle) ?></li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
                <?php if (!empty($resultado['fechas'])): ?>
                    <div class="aviso-enlaces">Ver programación:
                    <?php foreach ($resultado['fechas'] as $f): ?>
                        <a href="programacion.php?fecha=<?= htmlspecialchars($f) ?>"><?= htmlspecialchars($f) ?></a>
                    <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        </div>
        <?php endif; ?>

        <form id="form-subida" class="form-subida" action="prograingresos.php"
              method="post" enctype="multipart/form-data">

            <input type="hidden" name="csv_texto" id="csv-texto" disabled>
            <input type="hidden" name="colores" id="colores-json" disabled>

            <div class="zona-subida">
                <input type="file" id="archivo" name="archivo" accept=".xlsx,.csv" hidden>
                <button type="button" id="btn-subir" class="btn-subir">⬆ Subir archivo</button>
                <span id="nombre-archivo" class="nombre-archivo">Ningún archivo seleccionado (formato .xlsx o .csv)</span>
            </div>

            <div id="resumen" class="resumen" hidden></div>
            <div id="avisos" class="avisos" hidden></div>

            <section id="vista-previa" class="vista-previa" hidden>
                <h2>Vista previa</h2>
                <div class="tabla-scroll">
                    <table id="tabla-previa">
                        <thead></thead>
                        <tbody></tbody>
                    </table>
                </div>
            </section>

            <div id="acciones" class="acciones" hidden>
                <button type="submit" id="btn-confirmar" class="btn-confirmar">Confirmar y subir</button>
                <button type="button" id="btn-cancelar" class="btn-cancelar">Cancelar</button>
            </div>
        </form>
    </main>

    <div class="cyber-toggle-wrapper">
        <input class="cyber-toggle-checkbox" id="cyber-toggle" type="checkbox" />
        <label class="cyber-toggle" for="cyber-toggle">
        <div class="cyber-toggle-track">
            <div class="cyber-toggle-track-glow"></div>
            <div class="cyber-toggle-track-dots">
            <span class="cyber-toggle-track-dot"></span>
            <span class="cyber-toggle-track-dot"></span>
            <span class="cyber-toggle-track-dot"></span>
            </div>
        </div>
        <div class="cyber-toggle-thumb">
            <div class="cyber-toggle-thumb-shadow"></div>
            <div class="cyber-toggle-thumb-highlight"></div>
            <div class="cyber-toggle-thumb-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M16.5 12c0-2.48-2.02-4.5-4.5-4.5s-4.5 2.02-4.5 4.5 2.02 4.5 4.5 4.5 4.5-2.02 4.5-4.5zm-4.5 7.5c-4.14 0-7.5-3.36-7.5-7.5s3.36-7.5 7.5-7.5 7.5 3.36 7.5 7.5-3.36 7.5-7.5 7.5zm0-16.5c-4.97 0-9 4.03-9 9h-3l3.89 3.89.07.14 4.04-4.03h-3c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42c1.63 1.63 3.87 2.64 6.36 2.64 4.97 0 9-4.03 9-9s-4.03-9-9-9z"></path>
            </svg>
            </div>
        </div>
        <div class="cyber-toggle-particles">
            <span class="cyber-toggle-particle"></span>
            <span class="cyber-toggle-particle"></span>
            <span class="cyber-toggle-particle"></span>
            <span class="cyber-toggle-particle"></span>
        </div>
        </label>
        <div class="cyber-toggle-labels">
        <span class="cyber-toggle-label-off">OFF</span>
        <span class="cyber-toggle-label-on">ON</span>
        </div>
    </div>

    <script src="scrip/script.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="scrip/ingresos.js" charset="utf-8"></script>
</body>
</html>