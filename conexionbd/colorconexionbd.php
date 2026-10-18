<?php
require 'conexion.php';
header('Content-Type: application/json; charset=utf-8');

$id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
$color = $_POST['color'] ?? '';

if (!$id || ($color !== '' && !preg_match('/^#[0-9a-fA-F]{6}$/', $color))) {
    echo json_encode(['ok' => false]);
    exit;
}

$color = ($color === '') ? null : $color;

$stmt = $conexion->prepare("UPDATE ordenes SET color = ? WHERE id = ?");
$stmt->bind_param('si', $color, $id);
$stmt->execute();

echo json_encode(['ok' => true]);