<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    // Muestra el formulario de ingreso
    public function mostrarLogin()
    {
        return view('login');
    }

    // Valida los datos y abre la sesión
    public function ingresar(Request $solicitud)
    {
        $credenciales = $solicitud->validate([
            'email'    => ['required', 'email'],
            'password' => ['required'],
        ], [
            'email.required'    => 'Escribí tu email.',
            'email.email'       => 'El email no tiene un formato válido.',
            'password.required' => 'Escribí tu contraseña.',
        ]);

        if (! Auth::attempt($credenciales, $solicitud->boolean('recordar'))) {
            return back()
                ->withErrors(['email' => 'El email o la contraseña son incorrectos.'])
                ->onlyInput('email');
        }

        // Cambia el id de sesión al ingresar (evita el robo de sesión)
        $solicitud->session()->regenerate();

        return redirect()->intended(route('panel'));
    }

    // Cierra la sesión
    public function salir(Request $solicitud)
    {
        Auth::logout();

        $solicitud->session()->invalidate();
        $solicitud->session()->regenerateToken();

        return redirect()->route('login');
    }
}