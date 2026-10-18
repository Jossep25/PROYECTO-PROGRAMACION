<?php
require 'conexionbd/conexion.php';
 
$resultado = $conexion->query(
    "SELECT id, orden, fecha_produccion, codigo, producto, cliente, tipo,
            cantidad, fecha_limite_area2, observacion, color
     FROM ordenes
     ORDER BY fecha_produccion DESC"
);
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ventana de programacion</title>
    <link rel="stylesheet" href="style/styleprogra.css">
</head>
<body>
    <aside class="sidebar-left">
        <div class="sidebar-logo">
        YO<span>VEGETA</span>
        </div>
        <ul class="sidebar-menu">
            <li><a href="principal.html">🐾<span>Inicio</span></a></li>
            <li><a href="programacion.php" class="active">📃<span>Programacion</span></a></li>
            <li><a href="#">⬆<span>Ingresos</span></a></li>
        </ul>
        <div class="sidebar-footer">
        <a href="login.html" class="logout-link">✖︎<span>Salir</span></a>
        </div>
    </aside>
 
    <main class="main-content">
        <h1>Ventana de programacion</h1>
 
        <table>
            <thead>
                <tr>
                    <th>Orden</th>
                    <th>Fecha Prod.</th>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Fecha límite Área 2</th>
                    <th>Observación</th>
                    <th>Resaltar</th>
                </tr>
            </thead>
            <tbody>
                <?php while ($fila = $resultado->fetch_assoc()): ?>
                <tr data-id="<?= (int) $fila['id'] ?>"
                    <?php if (!empty($fila['color'])): ?>
                    class="resaltado" style="--resalte: <?= htmlspecialchars($fila['color']) ?>"
                    <?php endif; ?>>
                    <td><?= htmlspecialchars($fila['orden'] ?? '') ?></td>
                    <td><?= htmlspecialchars($fila['fecha_produccion'] ?? '') ?></td>
                    <td><?= htmlspecialchars($fila['codigo'] ?? '') ?></td>
                    <td><?= htmlspecialchars($fila['producto'] ?? '') ?></td>
                    <td><?= htmlspecialchars($fila['cliente'] ?? '') ?></td>
                    <td><?= htmlspecialchars($fila['tipo'] ?? '') ?></td>
                    <td><?= htmlspecialchars($fila['cantidad'] ?? '') ?></td>
                    <td><?= htmlspecialchars($fila['fecha_limite_area2'] ?? '') ?></td>
                    <td><?= htmlspecialchars($fila['observacion'] ?? '') ?></td>
                    <td>
                        <input type="color" class="selector-color"
                            value="<?= htmlspecialchars($fila['color'] ?? '#ffffff') ?>">
                        <button type="button" class="btn-quitar">Quitar</button>
                    </td>
                </tr>
                <?php endwhile; ?>
            </tbody>
        </table>
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
    <script src="scrip/programacion.js"></script>
</body>
</html>