import sqlite3
from flask import Flask, jsonify, request # Importamos 'request' para manejar peticiones POST
from flask_cors import CORS

# Nombre de tu archivo de base de datos
DATABASE = 'db_ultratech.db'

app = Flask(__name__)
CORS(app) # Habilitar CORS para todas las rutas

# --- Funciones de Utilidad para la Base de Datos ---

def get_db_connection():
    """Establece una conexión a la base de datos SQLite."""
    conn = sqlite3.connect(DATABASE)
    # Convierte las filas de la base de datos en diccionarios.
    # Esto facilita trabajar con los datos en formato JSON.
    conn.row_factory = sqlite3.Row
    return conn

# --- Endpoints de la API ---

@app.route('/marcas', methods=['GET'])
def get_marcas():
    """
    Ruta para obtener todas las marcas disponibles en la base de datos.
    Devuelve una lista de marcas en formato JSON.
    """
    conn = get_db_connection()
    marcas = conn.execute('SELECT * FROM marcas').fetchall()
    conn.close()

    marcas_list = [dict(marca) for marca in marcas]
    return jsonify(marcas_list)

@app.route('/modelos/<int:marca_id>', methods=['GET'])
def get_modelos_por_marca(marca_id):
    """
    Ruta para obtener los modelos asociados a una marca específica.
    :param marca_id: ID de la marca.
    Devuelve una lista de modelos en formato JSON.
    """
    conn = get_db_connection()
    modelos = conn.execute('SELECT * FROM modelos WHERE id_marca = ?', (marca_id,)).fetchall()
    conn.close()

    modelos_list = [dict(modelo) for modelo in modelos]
    return jsonify(modelos_list)

@app.route('/tipos_reparacion/<int:modelo_id>', methods=['GET'])
def get_tipos_reparacion_por_modelo(modelo_id):
    """
    Ruta para obtener los tipos de reparación disponibles para un modelo específico.
    :param modelo_id: ID del modelo.
    Devuelve una lista de tipos de reparación en formato JSON.
    """
    conn = get_db_connection()
    reparaciones = conn.execute(
        'SELECT id_reparacion, tipo_reparacion, precio, disponibilidad, descripcion_breve '
        'FROM reparaciones WHERE id_modelo = ?', (modelo_id,)
    ).fetchall()
    conn.close()

    reparaciones_list = [dict(rep) for rep in reparaciones]
    return jsonify(reparaciones_list)

@app.route('/cotizar', methods=['POST'])
def cotizar_reparacion():
    """
    Ruta para obtener la cotización final de una reparación específica.
    Esperamos los siguientes datos en el cuerpo de la solicitud POST (JSON):
    {
        "marca_id": <id_de_la_marca>,
        "modelo_id": <id_del_modelo>,
        "tipo_reparacion_id": <id_del_tipo_de_reparacion>
    }
    Devuelve el detalle de la reparación incluyendo precio y disponibilidad.
    """
    data = request.get_json()

    # Validar que los datos requeridos estén presentes
    if not data or not all(k in data for k in ('marca_id', 'modelo_id', 'tipo_reparacion_id')):
        return jsonify({"error": "Faltan datos en la solicitud (marca_id, modelo_id, tipo_reparacion_id)"}), 400

    marca_id = data['marca_id']
    modelo_id = data['modelo_id']
    tipo_reparacion_id = data['tipo_reparacion_id']

    conn = get_db_connection()
    try:
        # Aquí combinamos las tres tablas para obtener todos los detalles de la cotización
        cotizacion = conn.execute(
            '''
            SELECT
                m.nombre_marca,
                mo.nombre_modelo,
                r.tipo_reparacion,
                r.precio,
                r.disponibilidad,
                r.descripcion_breve,
                r.id_reparacion -- Podría ser útil para el frontend
            FROM reparaciones r
            JOIN modelos mo ON r.id_modelo = mo.id_modelo
            JOIN marcas m ON mo.id_marca = m.id_marca
            WHERE m.id_marca = ? AND mo.id_modelo = ? AND r.id_reparacion = ?
            ''',
            (marca_id, modelo_id, tipo_reparacion_id)
        ).fetchone() # fetchone() porque esperamos una sola fila

        if cotizacion:
            # Convertir el objeto Row a diccionario
            return jsonify(dict(cotizacion))
        else:
            return jsonify({"message": "No se encontró cotización para los parámetros dados."}), 404
    except Exception as e:
        return jsonify({"error": f"Error en la base de datos: {str(e)}"}), 500
    finally:
        conn.close()


# --- Ejecutar la Aplicación Flask ---

if __name__ == '__main__':
    # Esto ejecuta el servidor de desarrollo de Flask.
    # debug=True permite recargas automáticas y mensajes de error detallados.
    # host='0.0.0.0' permite que la aplicación sea accesible desde otras máquinas en la red local (útil para pruebas en móvil, etc.)
    app.run(debug=True, port=5000, host='0.0.0.0')