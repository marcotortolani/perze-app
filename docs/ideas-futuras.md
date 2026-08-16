# Ideas futuras

Ideas de producto que surgen en el camino y no son parte del alcance actual. Se anotan acá para
no perderlas y evaluarlas más adelante — nada de lo que sigue está decidido ni programado.

## Módulo de finanzas profesionales

Surgió el 2026-08-09, migrando el Excel histórico de finanzas personales: una de las pestañas
(`Ahorros`) tenía una columna de recordatorios de pagos pendientes a un socio de la empresa de
Pau. No tiene sentido migrar eso a las finanzas personales — es de otro dominio.

**Idea**: un módulo nuevo de Perze para organización profesional — tu empresa, tu actividad
unipersonal, o las finanzas de tu negocio — que viva **dentro de la misma cuenta de Perze pero
separado** de las finanzas personales. Falta definir el mecanismo de separación (¿un household
aparte? ¿un scope nuevo dentro del mismo household?) y si comparte algo con el household
familiar (`family`) o es completamente independiente.

## Simulador what-if / proyección Monte Carlo

Surgió el 2026-08-16, en el cierre de la auditoría técnica de ese mismo día (sección Producto,
gap "What-if / Monte Carlo", Nivel 5 de `docs/00-producto.md` § "Proyección y simulación").
Explícitamente descartado para este plan de cierre, no para siempre.

**Idea**: correr miles de trayectorias de retorno simuladas (en vez de una proyección lineal
única) para responder preguntas tipo "¿y si ahorro $X más por mes?" o "¿y si me jubilo a los Y
años?", mostrando un rango de probabilidad en vez de un número determinístico. Necesitaría un
modelo de distribución de retornos por instrumento/clase de activo, un motor de simulación
(computacionalmente pesado, no trivial de correr en el cliente) y una UI para definir parámetros
y mostrar bandas de probabilidad (fan chart).

**Por qué se dejó afuera ahora**: costo de desarrollo y de pruebas desproporcionado frente al
beneficio actual — es una feature de usuario avanzado, lejos del caso de uso central de la app
("cargar un gasto en <5s"). No hay una versión chica y barata de esto: o se construye la
simulación en serio, o no aporta nada a medias. Se retoma si en algún momento el resto del
roadmap de inversiones (Nivel 4 de `docs/00-producto.md`) ya está resuelto y sobra presupuesto
de desarrollo para una feature de largo plazo sin urgencia.
