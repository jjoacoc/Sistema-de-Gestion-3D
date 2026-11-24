<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerificarRol
{
    // Se usa en las rutas así: ->middleware('rol:administrador')
    // Deja pasar solo si el usuario tiene alguno de los roles indicados.
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $usuario = $request->user();

        if (! $usuario || ! in_array($usuario->rol, $roles, true)) {
            abort(403, 'No tenés permiso para realizar esta acción.');
        }

        return $next($request);
    }
}