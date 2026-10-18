<?php
$conexion = new mysqli("localhost", "root", "", "bdprueba", 3307);
$conexion->set_charset("utf8mb4");

if ($conexion->connect_error) {
    die("Error de conexión");
}