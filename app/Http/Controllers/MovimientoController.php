<?php

namespace App\Http\Controllers;

use App\Models\Movimiento;
use Illuminate\Http\Request;

class MovimientoController extends Controller
{
    // Historial de movimientos, del más nuevo al más viejo, con filtros y paginación
    public function listar(Request $solicitud)
    {
        $consulta = Movimiento::with(['producto', 'usuario'])->latest()->latest('id');

        // Filtro por tipo (entrada / salida)
        $tipo = $solicitud->query('tipo');
        if (in_array($tipo, ['entrada', 'salida'], true)) {
            $consulta->where('tipo', $tipo);
        }

        // Búsqueda por nombre o código de la prenda
        $buscar = trim((string) $solicitud->query('buscar', ''));
        if ($buscar !== '') {
            $consulta->whereHas('producto', function ($subconsulta) use ($buscar) {
                $subconsulta->where('nombre', 'like', "%$buscar%")
                    ->orWhere('codigo', 'like', "%$buscar%");
            });
        }

        // withQueryString() mantiene los filtros al cambiar de página
        $movimientos = $consulta->paginate(15)->withQueryString();

        return view('movimientos.listar', [
            'movimientos' => $movimientos,
            'tipo'        => $tipo,
            'buscar'      => $buscar,
        ]);
    }
}