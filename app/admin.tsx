import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Modal, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { apifb } from '../lib/apiFootball';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', green:'#00c897', orange:'#ff9f43', red:'#ff6b6b', gold:'#ffd700' };

type Partido = { id:string; local:string; visitante:string; fecha:string; jornada:number; cerrado:boolean; resultado_final:string|null };
type Quiniela = { id:string; jornada:number; estado_pago:string; usuario_id:string; usuarios:{nombre:string;username:string}|null };
type Fixture = { fixture:{id:number;date:string;status:{short:string}}; teams:{home:{name:string};away:{name:string}} };
type TabAdmin = 'partidos' | 'importar' | 'quinielas';

// Ligas populares con sus IDs oficiales de api-football
const LIGAS_POPULARES = [
  { nombre:'Liga MX Apertura', id:'262', temporada:'2026' },
  { nombre:'Liga MX Clausura', id:'263', temporada:'2025' },
  { nombre:'FIFA World Cup',   id:'1',   temporada:'2026' },
  { nombre:'UEFA Champions',   id:'2',   temporada:'2024' },
  { nombre:'Premier League',  id:'39',  temporada:'2024' },
  { nombre:'La Liga',         id:'140', temporada:'2024' },
  { nombre:'Ligue 1',         id:'61',  temporada:'2024' },
  { nombre:'Serie A',         id:'135', temporada:'2024' },
  { nombre:'Bundesliga',      id:'78',  temporada:'2024' },
  { nombre:'MLS',             id:'253', temporada:'2025' },
  { nombre:'Liga MX U21',     id:'1200',temporada:'2025' },
];

export default function AdminScreen() {
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<TabAdmin>('partidos');
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [quinielas, setQuinielas] = useState<Quiniela[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal partido manual
  const [modalPartido, setModalPartido] = useState(false);
  const [modalResultado, setModalResultado] = useState(false);
  const [partidoSel, setPartidoSel] = useState<Partido|null>(null);
  const [resultadoInput, setResultadoInput] = useState<'1'|'X'|'2'|null>(null);
  const [saving, setSaving] = useState(false);
  const [local,setLocal]=useState('');
  const [visitante,setVisitante]=useState('');
  const [fecha,setFecha]=useState('');
  const [hora,setHora]=useState('');
  const [jornada,setJornada]=useState('1');

  // Importar — inputs directos
  const [ligaId, setLigaId] = useState('262');
  const [temporada, setTemporada] = useState('2026');
  const [modoBusqueda, setModoBusqueda] = useState<'fecha'|'semana'|'jornada'>('jornada');
  const [fechaBusqueda, setFechaBusqueda] = useState(new Date().toISOString().split('T')[0]);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [roundInput, setRoundInput] = useState('1'); // jornada/round
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [jornadaImport, setJornadaImport] = useState('1');
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    if (!usuario?.es_admin) { Alert.alert('Acceso denegado','No tienes permisos.'); router.back(); return; }
    cargarDatos();
  }, [usuario]);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data:p },{ data:q }] = await Promise.all([
      supabase.from('partidos').select('*').order('jornada').order('fecha'),
      supabase.from('quinielas').select('id,jornada,estado_pago,usuario_id,usuarios(nombre,username)').order('jornada',{ascending:false}),
    ]);
    if (p) setPartidos(p);
    if (q) setQuinielas(q as any);
    setLoading(false);
  };

  const aplicarLigaRapida = (l: typeof LIGAS_POPULARES[0]) => {
    setLigaId(l.id);
    setTemporada(l.temporada);
    setFixtures([]);
    setSeleccionados(new Set());
  };

  const buscarFixtures = async () => {
    if (!ligaId || !temporada) { Alert.alert('Faltan datos','Ingresa el ID de la liga y la temporada.'); return; }
    setLoadingFixtures(true); setFixtures([]); setSeleccionados(new Set());
    try {
      let data;
      if (modoBusqueda === 'fecha') {
        data = await apifb.fixtures(ligaId, temporada, fechaBusqueda);
      } else if (modoBusqueda === 'semana') {
        data = await apifb.fixturesPorSemana(ligaId, temporada, fechaDesde, fechaHasta);
      } else {
        // Por jornada/round — formato: "Regular Season - 1"
        const round = `Regular Season - ${roundInput}`;
        data = await apifb.fixturesPorRound(ligaId, temporada, round);
      }
      const res: Fixture[] = data.response || [];
      setFixtures(res);
      if (!res.length) Alert.alert('Sin partidos',
        `No se encontraron partidos.\n\nVerifica:\n• ID de liga: ${ligaId}\n• Temporada: ${temporada}\n• Que la jornada/fecha exista`);
    } catch (e) { Alert.alert('Error', String(e)); }
    setLoadingFixtures(false);
  };

  const toggleSel = (id:number) => {
    setSeleccionados(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });
  };

  const importarPartidos = async () => {
    if (!seleccionados.size) { Alert.alert('Sin selección','Selecciona al menos un partido.'); return; }
    setImportando(true);
    const inserts = fixtures
      .filter(f=>seleccionados.has(f.fixture.id))
      .map(f => ({ local:f.teams.home.name, visitante:f.teams.away.name, fecha:f.fixture.date, jornada:parseInt(jornadaImport), cerrado:false, api_fixture_id:f.fixture.id }));
    const { error } = await supabase.from('partidos').insert(inserts);
    setImportando(false);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('✅ Importados', `${inserts.length} partidos en Jornada ${jornadaImport}.`);
    setFixtures([]); setSeleccionados(new Set());
    setTab('partidos'); cargarDatos();
  };

  const guardarResultado = async () => {
    if (!resultadoInput||!partidoSel) return;
    setSaving(true);
    const { error } = await supabase.from('partidos').update({resultado_final:resultadoInput,cerrado:true}).eq('id',partidoSel.id);
    if (error) { Alert.alert('Error',error.message); setSaving(false); return; }
    await recalcularAciertos(partidoSel.jornada);
    setSaving(false); setModalResultado(false); cargarDatos();
    Alert.alert('✅ Listo','Resultado guardado.');
  };

  const recalcularAciertos = async (jornadaNum:number) => {
    const { data:pJs } = await supabase.from('partidos').select('id,resultado_final').eq('jornada',jornadaNum).not('resultado_final','is',null);
    if (!pJs?.length) return;
    const ids = pJs.map(p=>p.id);
    const { data:qJs } = await supabase.from('quinielas').select('id,usuario_id').eq('jornada',jornadaNum);
    for (const q of (qJs||[])) {
      const { data:preds } = await supabase.from('predicciones').select('partido_id,resultado').eq('usuario_id',q.usuario_id).in('partido_id',ids);
      const aciertos = (preds||[]).filter(pr=>pJs.find(x=>x.id===pr.partido_id)?.resultado_final===pr.resultado).length;
      await supabase.from('quinielas').update({aciertos}).eq('id',q.id);
    }
  };

  const agregarPartido = async () => {
    if (!local||!visitante||!fecha||!hora||!jornada) { Alert.alert('Campos incompletos','Llena todos los campos.'); return; }
    setSaving(true);
    const { error } = await supabase.from('partidos').insert({ local:local.trim(), visitante:visitante.trim(), fecha:`${fecha}T${hora}:00-06:00`, jornada:parseInt(jornada), cerrado:false });
    setSaving(false);
    if (error) { Alert.alert('Error',error.message); return; }
    setModalPartido(false); setLocal(''); setVisitante(''); setFecha(''); setHora(''); cargarDatos();
  };

  const toggleCerrar = async (p:Partido) => { await supabase.from('partidos').update({cerrado:!p.cerrado}).eq('id',p.id); cargarDatos(); };
  const eliminarPartido = (id:string) => Alert.alert('Eliminar','¿Eliminar?',[{text:'Cancelar',style:'cancel'},{text:'Eliminar',style:'destructive',onPress:async()=>{await supabase.from('partidos').delete().eq('id',id);cargarDatos();}}]);
  const marcarPagado = async (qId:string) => { const{error}=await supabase.from('quinielas').update({estado_pago:'pagado'}).eq('id',qId); if(!error) cargarDatos(); };

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.accent} size="large"/></View>;

  const jornadaActual = partidos.find(p=>!p.cerrado)?.jornada??'-';
  const pagados = quinielas.filter(q=>q.estado_pago==='pagado').length;
  const pendientes = quinielas.filter(q=>q.estado_pago==='pendiente').length;
  const statusColor = (s:string) => s==='FT'?C.green:s==='NS'?C.textSub:C.orange;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS==='ios'?'padding':'height'}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>

      {/* Header */}
      <View style={[styles.header,{paddingTop:insets.top+12}]}>
        <TouchableOpacity onPress={()=>router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text}/>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛡️ Panel Admin</Text>
        <View style={{width:40}}/>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statNum}>{jornadaActual}</Text><Text style={styles.statLabel}>Jornada</Text></View>
        <View style={styles.stat}><Text style={[styles.statNum,{color:C.green}]}>{pagados}</Text><Text style={styles.statLabel}>Pagados</Text></View>
        <View style={styles.stat}><Text style={[styles.statNum,{color:C.orange}]}>{pendientes}</Text><Text style={styles.statLabel}>Pendientes</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{quinielas.length}</Text><Text style={styles.statLabel}>Total</Text></View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['partidos','importar','quinielas'] as TabAdmin[]).map(t=>(
          <TouchableOpacity key={t} style={[styles.tabBtn,tab===t&&styles.tabActivo]} onPress={()=>setTab(t)}>
            <Text style={[styles.tabTexto,tab===t&&styles.tabTextoActivo]}>
              {t==='partidos'?'⚽ Partidos':t==='importar'?'📡 Importar':'📋 Quinielas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{flex:1}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:insets.bottom+40}}>

        {/* ====== TAB PARTIDOS ====== */}
        {tab==='partidos' && (
          <>
            <TouchableOpacity style={styles.btnAgregar} onPress={()=>setModalPartido(true)} activeOpacity={0.8}>
              <Ionicons name="add-circle" size={20} color={C.textSub}/>
              <Text style={styles.btnAgregarTexto}>Agregar partido manualmente</Text>
            </TouchableOpacity>
            {partidos.length===0
              ? <View style={styles.emptyBox}><Text style={styles.emptyText}>No hay partidos aún.</Text></View>
              : partidos.map(p=>(
                <View key={p.id} style={styles.card}>
                  <Text style={styles.cardJornada}>Jornada {p.jornada}{p.cerrado&&<Text style={{color:C.red}}> • Cerrado</Text>}</Text>
                  <Text style={styles.cardPartido}>{p.local} vs {p.visitante}</Text>
                  <Text style={styles.cardFecha}>{new Date(p.fecha).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</Text>
                  {p.resultado_final&&(
                    <View style={styles.resultadoTag}>
                      <Ionicons name="checkmark-circle" size={13} color={C.green}/>
                      <Text style={styles.resultadoTagTexto}>{p.resultado_final==='1'?`Local: ${p.local}`:p.resultado_final==='X'?'Empate':`Visitante: ${p.visitante}`}</Text>
                    </View>
                  )}
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={()=>{setPartidoSel(p);setResultadoInput(p.resultado_final as any||null);setModalResultado(true);}} style={[styles.actionBtn,{backgroundColor:C.accent}]}>
                      <Text style={styles.actionBtnTexto}>{p.resultado_final?'✏️ Editar':'🎯 Resultado'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>toggleCerrar(p)} style={[styles.actionBtn,p.cerrado?{backgroundColor:C.green}:{backgroundColor:C.orange}]}>
                      <Text style={styles.actionBtnTexto}>{p.cerrado?'Abrir':'Cerrar'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>eliminarPartido(p.id)} style={[styles.actionBtn,{backgroundColor:C.red}]}>
                      <Ionicons name="trash" size={14} color="#fff"/>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            }
          </>
        )}

        {/* ====== TAB IMPORTAR ====== */}
        {tab==='importar' && (
          <View style={{padding:16}}>

            {/* Ligas rápidas */}
            <View style={styles.seccionCard}>
              <Text style={styles.seccionTitulo}>⚡ Ligas rápidas</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:4}}>
                {LIGAS_POPULARES.map(l=>(
                  <TouchableOpacity
                    key={l.id}
                    style={[styles.ligaChip, ligaId===l.id&&temporada===l.temporada&&styles.ligaChipActiva]}
                    onPress={()=>aplicarLigaRapida(l)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.ligaChipTexto, ligaId===l.id&&temporada===l.temporada&&{color:C.accent}]} numberOfLines={1}>{l.nombre}</Text>
                    <Text style={styles.ligaChipSub}>{l.temporada}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Datos manuales */}
            <View style={styles.seccionCard}>
              <Text style={styles.seccionTitulo}>🔢 Liga y temporada</Text>
              <View style={styles.rowInputs}>
                <View style={{flex:1}}>
                  <Text style={styles.label}>ID de liga</Text>
                  <TextInput style={styles.input} value={ligaId} onChangeText={setLigaId} keyboardType="number-pad" placeholder="262" placeholderTextColor="#555577"/>
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.label}>Temporada</Text>
                  <TextInput style={styles.input} value={temporada} onChangeText={setTemporada} keyboardType="number-pad" placeholder="2025" placeholderTextColor="#555577" maxLength={4}/>
                </View>
              </View>
            </View>

            {/* Modo de búsqueda */}
            <View style={styles.seccionCard}>
              <Text style={styles.seccionTitulo}>📅 Buscar partidos por</Text>
              <View style={styles.modoRow}>
                {(['jornada','fecha','semana'] as const).map(m=>(
                  <TouchableOpacity key={m} style={[styles.modoBtn,modoBusqueda===m&&styles.modoBtnActivo]} onPress={()=>setModoBusqueda(m)}>
                    <Text style={[styles.modoBtnTexto,modoBusqueda===m&&{color:C.accent}]}>
                      {m==='jornada'?'Jornada':m==='fecha'?'Día':'Semana'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {modoBusqueda==='jornada' && (
                <><Text style={styles.label}>Número de jornada</Text>
                <TextInput style={styles.input} value={roundInput} onChangeText={setRoundInput} keyboardType="number-pad" placeholder="1" placeholderTextColor="#555577"/>
                <Text style={styles.hint}>Se buscará como "Regular Season - {roundInput}"</Text></>
              )}
              {modoBusqueda==='fecha' && (
                <><Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={fechaBusqueda} onChangeText={setFechaBusqueda} placeholder="2025-04-05" placeholderTextColor="#555577"/></>
              )}
              {modoBusqueda==='semana' && (
                <><Text style={styles.label}>Desde</Text>
                <TextInput style={styles.input} value={fechaDesde} onChangeText={setFechaDesde} placeholder="2025-04-01" placeholderTextColor="#555577"/>
                <Text style={styles.label}>Hasta</Text>
                <TextInput style={styles.input} value={fechaHasta} onChangeText={setFechaHasta} placeholder="2025-04-07" placeholderTextColor="#555577"/></>
              )}

              <TouchableOpacity style={styles.btnBuscar} onPress={buscarFixtures} activeOpacity={0.8}>
                {loadingFixtures
                  ? <ActivityIndicator color="#fff" size="small"/>
                  : <><Ionicons name="search" size={16} color="#fff"/><Text style={styles.btnBuscarTexto}>Buscar partidos</Text></>}
              </TouchableOpacity>
            </View>

            {/* Resultados */}
            {fixtures.length>0 && (
              <View style={styles.seccionCard}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <Text style={styles.seccionTitulo}>{fixtures.length} partidos — {seleccionados.size} seleccionados</Text>
                  <TouchableOpacity onPress={()=>seleccionados.size===fixtures.length?setSeleccionados(new Set()):setSeleccionados(new Set(fixtures.map(f=>f.fixture.id)))}>
                    <Text style={{color:C.accent,fontSize:12,fontWeight:'700'}}>{seleccionados.size===fixtures.length?'Quitar todos':'Todos'}</Text>
                  </TouchableOpacity>
                </View>
                {fixtures.map(f=>{
                  const sel = seleccionados.has(f.fixture.id);
                  const st = f.fixture.status.short;
                  return (
                    <TouchableOpacity key={f.fixture.id} style={[styles.fixtureRow,sel&&styles.fixtureRowSel]} onPress={()=>toggleSel(f.fixture.id)} activeOpacity={0.7}>
                      <View style={[styles.checkbox,sel&&styles.checkboxSel]}>
                        {sel&&<Ionicons name="checkmark" size={14} color="#fff"/>}
                      </View>
                      <View style={{flex:1,marginLeft:10}}>
                        <Text style={styles.fixtureEquipos}>{f.teams.home.name} vs {f.teams.away.name}</Text>
                        <Text style={styles.fixtureFecha}>{new Date(f.fixture.date).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</Text>
                      </View>
                      <View style={[styles.statusBadge,{borderColor:statusColor(st)}]}>
                        <Text style={[styles.statusTexto,{color:statusColor(st)}]}>{st}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Crear quiniela */}
            {seleccionados.size>0 && (
              <View style={styles.seccionCard}>
                <Text style={styles.seccionTitulo}>🎉 Crear quiniela</Text>
                <Text style={styles.label}>Número de jornada en tu quiniela</Text>
                <TextInput style={styles.input} value={jornadaImport} onChangeText={setJornadaImport} keyboardType="number-pad" placeholderTextColor="#555577"/>
                <TouchableOpacity style={[styles.btnImportar,importando&&{opacity:0.6}]} onPress={importarPartidos} disabled={importando} activeOpacity={0.8}>
                  {importando
                    ? <ActivityIndicator color="#fff"/>
                    : <><Ionicons name="cloud-upload" size={18} color="#fff"/><Text style={styles.btnImportarTexto}>Crear Jornada {jornadaImport} ({seleccionados.size} partidos)</Text></>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ====== TAB QUINIELAS ====== */}
        {tab==='quinielas' && (
          quinielas.length===0
            ? <View style={styles.emptyBox}><Text style={styles.emptyText}>No hay quinielas registradas.</Text></View>
            : quinielas.map(q=>(
              <View key={q.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{flex:1}}>
                    <Text style={styles.cardPartido}>{(q.usuarios as any)?.username?`@${(q.usuarios as any).username}`:(q.usuarios as any)?.nombre||'Usuario'}</Text>
                    <Text style={styles.cardJornada}>Jornada {q.jornada}</Text>
                  </View>
                  {q.estado_pago==='pagado'
                    ? <View style={[styles.actionBtn,{backgroundColor:'rgba(0,200,151,0.15)',borderWidth:1,borderColor:C.green}]}><Text style={[styles.actionBtnTexto,{color:C.green}]}>✅ Pagado</Text></View>
                    : <TouchableOpacity onPress={()=>marcarPagado(q.id)} style={[styles.actionBtn,{backgroundColor:C.accent}]}><Text style={styles.actionBtnTexto}>Marcar pagado</Text></TouchableOpacity>
                  }
                </View>
              </View>
            ))
        )}
      </ScrollView>

      {/* Modal partido manual */}
      <Modal visible={modalPartido} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitulo}>Nuevo partido</Text>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {([['Equipo local',local,setLocal,'América'],['Equipo visitante',visitante,setVisitante,'Chivas'],['Fecha (YYYY-MM-DD)',fecha,setFecha,'2026-07-05'],['Hora (HH:MM)',hora,setHora,'20:00']] as const).map(([lbl,val,set,ph]:any)=>(
                  <View key={lbl}><Text style={styles.label}>{lbl}</Text><TextInput style={styles.input} value={val} onChangeText={set} placeholder={ph} placeholderTextColor="#555577"/></View>
                ))}
                <Text style={styles.label}>Jornada</Text>
                <TextInput style={styles.input} value={jornada} onChangeText={setJornada} keyboardType="number-pad"/>
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.btnCancelar} onPress={()=>setModalPartido(false)}><Text style={styles.btnCancelarTexto}>Cancelar</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.btnGuardar,saving&&{opacity:0.6}]} onPress={agregarPartido} disabled={saving}>
                    {saving?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.btnGuardarTexto}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal resultado */}
      <Modal visible={modalResultado} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Capturar resultado</Text>
            <Text style={styles.modalSubtitulo}>{partidoSel?.local} vs {partidoSel?.visitante}</Text>
            <View style={styles.resultadoOpciones}>
              {(['1','X','2'] as const).map(op=>(
                <TouchableOpacity key={op} style={[styles.resultadoOpcion,resultadoInput===op&&styles.resultadoOpcionActiva]} onPress={()=>setResultadoInput(op)}>
                  <Text style={[styles.resultadoOpcionTexto,resultadoInput===op&&{color:C.accent}]}>
                    {op==='1'?`1\n${partidoSel?.local}`:op==='X'?'X\nEmpate':`2\n${partidoSel?.visitante}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.infoAciertos}>⚡ Se recalculan aciertos automáticamente</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancelar} onPress={()=>setModalResultado(false)}><Text style={styles.btnCancelarTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnGuardar,(!resultadoInput||saving)&&{opacity:0.5}]} onPress={guardarResultado} disabled={!resultadoInput||saving}>
                {saving?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.btnGuardarTexto}>Guardar y calcular</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  center:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:C.bg},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingBottom:14,backgroundColor:C.bg},
  backBtn:{padding:6,borderRadius:10,backgroundColor:C.card},
  headerTitle:{color:C.text,fontSize:18,fontWeight:'bold'},
  statsRow:{flexDirection:'row',backgroundColor:C.card,marginHorizontal:16,borderRadius:14,padding:14,marginBottom:8,borderWidth:1,borderColor:C.cardBorder},
  stat:{flex:1,alignItems:'center'},
  statNum:{color:C.accent,fontSize:22,fontWeight:'bold'}, statLabel:{color:C.textSub,fontSize:11,marginTop:2},
  tabs:{flexDirection:'row',marginHorizontal:16,marginBottom:8,backgroundColor:C.card,borderRadius:12,padding:4,borderWidth:1,borderColor:C.cardBorder},
  tabBtn:{flex:1,padding:10,alignItems:'center',borderRadius:10},
  tabActivo:{backgroundColor:C.accentDim},
  tabTexto:{fontSize:12,fontWeight:'600',color:C.textSub}, tabTextoActivo:{color:C.accent},
  btnAgregar:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#1e2a35',borderWidth:1,borderColor:C.cardBorder,marginHorizontal:16,marginBottom:8,padding:13,borderRadius:12,justifyContent:'center'},
  btnAgregarTexto:{color:C.textSub,fontWeight:'600',fontSize:14},
  card:{backgroundColor:C.card,marginHorizontal:16,marginBottom:8,borderRadius:12,padding:14,borderWidth:1,borderColor:C.cardBorder},
  cardRow:{flexDirection:'row',alignItems:'center'},
  cardJornada:{fontSize:11,color:C.accent,fontWeight:'600',marginBottom:2},
  cardPartido:{fontSize:15,fontWeight:'bold',color:C.text},
  cardFecha:{fontSize:11,color:C.textSub,marginTop:2,marginBottom:8},
  resultadoTag:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(0,200,151,0.1)',padding:7,borderRadius:8,marginBottom:8,borderWidth:1,borderColor:C.green},
  resultadoTagTexto:{color:C.green,fontSize:12,fontWeight:'600'},
  cardActions:{flexDirection:'row',gap:6,flexWrap:'wrap'},
  actionBtn:{paddingHorizontal:12,paddingVertical:7,borderRadius:8,alignItems:'center'},
  actionBtnTexto:{color:'#fff',fontSize:12,fontWeight:'600'},
  emptyBox:{margin:16,padding:24,backgroundColor:C.card,borderRadius:12,alignItems:'center',borderWidth:1,borderColor:C.cardBorder},
  emptyText:{color:C.textSub,fontSize:14,textAlign:'center'},
  // Importar
  seccionCard:{backgroundColor:C.card,borderRadius:14,padding:16,marginBottom:12,borderWidth:1,borderColor:C.cardBorder},
  seccionTitulo:{color:C.text,fontWeight:'bold',fontSize:13,marginBottom:12},
  rowInputs:{flexDirection:'row',gap:12},
  ligaChip:{borderWidth:1.5,borderColor:C.cardBorder,borderRadius:10,paddingHorizontal:12,paddingVertical:8,backgroundColor:'#12121f',minWidth:110,alignItems:'center'},
  ligaChipActiva:{borderColor:C.accent,backgroundColor:C.accentDim},
  ligaChipTexto:{color:C.textSub,fontSize:12,fontWeight:'700'},
  ligaChipSub:{color:C.textSub,fontSize:10,marginTop:2,opacity:0.7},
  modoRow:{flexDirection:'row',gap:8,marginBottom:12},
  modoBtn:{flex:1,padding:9,borderRadius:10,borderWidth:1.5,borderColor:C.cardBorder,alignItems:'center'},
  modoBtnActivo:{borderColor:C.accent,backgroundColor:C.accentDim},
  modoBtnTexto:{color:C.textSub,fontWeight:'600',fontSize:12},
  label:{fontSize:12,fontWeight:'600',color:C.textSub,marginBottom:5,marginTop:4},
  hint:{fontSize:11,color:C.textSub,opacity:0.7,marginBottom:10,fontStyle:'italic'},
  input:{borderWidth:1.5,borderColor:C.cardBorder,borderRadius:10,padding:12,marginBottom:8,fontSize:14,color:C.text,backgroundColor:'#12121f'},
  btnBuscar:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.accent,padding:13,borderRadius:10,marginTop:4},
  btnBuscarTexto:{color:'#fff',fontWeight:'bold',fontSize:14},
  fixtureRow:{flexDirection:'row',alignItems:'center',padding:11,borderRadius:10,marginBottom:6,borderWidth:1.5,borderColor:C.cardBorder,backgroundColor:'#12121f'},
  fixtureRowSel:{borderColor:C.accent,backgroundColor:C.accentDim},
  checkbox:{width:22,height:22,borderRadius:6,borderWidth:2,borderColor:C.textSub,justifyContent:'center',alignItems:'center'},
  checkboxSel:{backgroundColor:C.accent,borderColor:C.accent},
  fixtureEquipos:{color:C.text,fontWeight:'600',fontSize:13},
  fixtureFecha:{color:C.textSub,fontSize:11,marginTop:2},
  statusBadge:{borderWidth:1.5,borderRadius:6,paddingHorizontal:6,paddingVertical:2},
  statusTexto:{fontSize:10,fontWeight:'700'},
  btnImportar:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.green,padding:15,borderRadius:12,marginTop:4},
  btnImportarTexto:{color:'#fff',fontWeight:'bold',fontSize:14},
  // Modales
  modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.7)',justifyContent:'flex-end'},
  modalCard:{backgroundColor:C.card,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,paddingBottom:34,borderTopWidth:1,borderColor:C.cardBorder},
  modalTitulo:{fontSize:18,fontWeight:'bold',color:C.text,marginBottom:4},
  modalSubtitulo:{fontSize:13,color:C.textSub,marginBottom:16},
  resultadoOpciones:{flexDirection:'row',gap:10,marginBottom:16},
  resultadoOpcion:{flex:1,borderWidth:2,borderColor:C.cardBorder,borderRadius:12,padding:14,alignItems:'center',backgroundColor:'#12121f'},
  resultadoOpcionActiva:{borderColor:C.accent,backgroundColor:C.accentDim},
  resultadoOpcionTexto:{fontSize:13,color:C.textSub,textAlign:'center',fontWeight:'600'},
  infoAciertos:{fontSize:12,color:C.textSub,textAlign:'center',marginBottom:12},
  modalBtns:{flexDirection:'row',gap:10},
  btnCancelar:{flex:1,padding:14,borderRadius:12,borderWidth:1.5,borderColor:C.cardBorder,alignItems:'center'},
  btnCancelarTexto:{color:C.textSub,fontWeight:'600'},
  btnGuardar:{flex:1,padding:14,borderRadius:12,backgroundColor:C.accent,alignItems:'center'},
  btnGuardarTexto:{color:'#fff',fontWeight:'bold'},
});
