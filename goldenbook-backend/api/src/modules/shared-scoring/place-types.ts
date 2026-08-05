// Qué tipos de ficha nunca son un sitio al que ir.
//
// Esto existía copiado en seis consultas distintas, y las seis compartían el
// mismo fallo: excluían 'services', 'real_estate' y 'corporate', tres valores
// que el constraint `places_place_type_check` no admite y que por tanto no
// existen en ninguna fila. Solo dos de los cinco hacían algo.
//
// El efecto no era teórico. ARCAYA, una promoción inmobiliaria del Algarve,
// estaba guardada como 'restaurant' con categoría gastronomy y una descripción
// generada que decía "A welcoming restaurant in the Algarve". Aparecía en los
// feeds de comida y podía entrar en un plan. Quien escribió el filtro creyó
// que las inmobiliarias estaban cubiertas por tipo, y no lo estaban.
//
// Valores admitidos por el constraint, a día de hoy:
//   restaurant, cafe, bar, shop, hotel, beach, museum,
//   activity, landmark, venue, transport, other
//
// Si se añade un tipo nuevo al constraint, hay que decidir aquí si es visitable.

/**
 * Tipos que se excluyen de recomendaciones, planes y feeds de descubrimiento.
 *
 *   transport  estaciones y paradas: se pasa por ellas, no se va a ellas
 *   other      cajón de sastre. Todo lo que no encaja en una categoría de
 *              visita acaba aquí, incluidas inmobiliarias y despachos, así
 *              que es la red que recoge lo que no supimos clasificar.
 */
export const NON_VISITABLE_PLACE_TYPES = ['transport', 'other'] as const

/**
 * Fragmento SQL listo para pegar en un WHERE. Se expone como cadena en vez de
 * como parámetro para que las consultas sigan siendo legibles de un vistazo y
 * no haya que renumerar los $1, $2 de seis sitios distintos.
 *
 * Seguro por construcción: los valores son literales de este módulo, nunca
 * entrada de usuario.
 */
export const EXCLUDE_NON_VISITABLE_SQL =
  `p.place_type NOT IN (${NON_VISITABLE_PLACE_TYPES.map((t) => `'${t}'`).join(', ')})`

/**
 * ATENCIÓN, y esto es lo que el filtro por tipo NO resuelve:
 *
 * Excluir por tipo solo funciona si el tipo es correcto. Una inmobiliaria
 * clasificada como 'restaurant' pasa por aquí sin que nada la detenga, que es
 * exactamente lo que ocurrió con ARCAYA durante meses.
 *
 * La defensa que falta es guardar el `primaryType` que devuelve Google
 * (general_contractor, real_estate_agency, lawyer, insurance_agency...) y
 * excluir también por él, porque ese dato es independiente de nuestra
 * clasificación y no se corrompe cuando alguien se equivoca al dar de alta.
 * Hoy no lo guardamos: `classification_auto` contiene nuestra propia
 * clasificación derivada, no la de Google.
 */
export const GOOGLE_TYPE_GUARD_PENDING = true
