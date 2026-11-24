<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProveedorRequest;
use App\Models\Proveedor;

class ProveedorController extends Controller
{
    // Lista de proveedores + formulario para crear uno
    public function listar()
    {
        $proveedores = Proveedor::withCount('productos')->orderBy('nombre')->get();

        return view('proveedores.listar', ['proveedores' => $proveedores]);
    }

    public function guardar(ProveedorRequest $solicitud)
    {
        $proveedor = Proveedor::create($solicitud->validated());

        return redirect()->route('proveedores.listar')
            ->with('exito', 'Proveedor "' . $proveedor->nombre . '" creado.');
    }

    public function editar(Proveedor $proveedor)
    {
        return view('proveedores.editar', ['proveedor' => $proveedor]);
    }

    public function actualizar(ProveedorRequest $solicitud, Proveedor $proveedor)
    {
        $proveedor->update($solicitud->validated());

        return redirect()->route('proveedores.listar')
            ->with('exito', 'Proveedor "' . $proveedor->nombre . '" actualizado.');
    }

    // Al borrar un proveedor, la base borra también sus vínculos con productos (cascadeOnDelete)
    public function eliminar(Proveedor $proveedor)
    {
        $nombre = $proveedor->nombre;
        $proveedor->delete();

        return redirect()->route('proveedores.listar')
            ->with('exito', 'Proveedor "' . $nombre . '" eliminado.');
    }
}