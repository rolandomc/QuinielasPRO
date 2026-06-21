import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Modal, StatusBar, KeyboardAvoidingView,
  Platform, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { apifb, mejorTemporada } from '../lib/apiFootball';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', green:'#00c897', orange:'#ff9f43', red:'#ff6b6b', gold:'#ffd700' };

type Partido = { id:string; local:string; visitante:string; fecha:string; jornada:number; cerrado:boolean; resultado_final:string|null };
type Quiniela = { id:string; jornada:number; estado_pago:string; usuario_id:string; usuarios:{nombre:string;username:string}|null };
type Liga = { league:{id:number;name:string;type:string}; country:{name:string}; seasons:{year:number;current:boolean}[] };
type Fixture = { fixture:{id:number;date:string;status:{short:string}}; teams:{home:{name:string};away:{name:string}} };
type TabAdmin = 'partidos' | 'importar' | 'quinielas';

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

  // Importar
  const [busquedaLiga, setBusquedaLiga] = useState('');
  const [ligas, setLigas] = useState<Liga[]>([]);
  const [loadingLigas, setLoadingLigas] = useState(false);
  const [ligaSel, setLigaSel] = useState<Liga|null>(null);
  const [temporadaSel, setTemporadaSel] = useState<string>('');
  const [temporadaManual, setTemporadaManual] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState<'dia'|'semana'>('dia');
  const [fechaBusqueda, setFechaBusqueda] = useState(new Date().toISOString().split('T')[0]);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
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

  // ── API Football ──────────────────────────────────────────
  const buscarLigas = async () => {
    const q = busquedaLiga.trim();
    if (!q) return;
    setLoadingLigas(true); setLigas([]); setLigaSel(null); setFixtures([]);
    try {
      // Busca sin filtro de season para incluir Ligas Y Copas
      const data = await apifb.ligas(q);
      const res: Liga[] = data.response || [];
      if (!res.length) {
        Alert.alert('Sin resultados', `No se encontró "${q}".\n\nSugerencias:\n• "Liga MX Apertura"\n• "Liga MX Clausura"\n• "FIFA World Cup"\n• "UEFA Champions League"`);
      }
      setLigas(res);
    } catch { Alert.alert('Error','No se pudo conectar con la API.'); }
    setLoadingLigas(false);
  };

  const seleccionarLiga = (l: Liga) => {
    setLigaSel(l);
    const t = mejorTemporada(l.seasons);
    setTemporadaSel(t);
    setTemporadaManual(t);
    setFixtures([]);
    setSeleccionados(new Set());
  };

  const temporadaFinal = temporadaManual.length === 4 ? temporadaManual : temporadaSel;

  const buscarFixtures = async () => {
    if (!ligaSel) return;
    if (!temporadaFinal) { Alert.alert('Falta temporada','Ingresa el año de la temporada.'); return; }
    setLoadingFixtures(true); setFixtures([]); setSeleccionados(new Set());
    try {
      let data;
      if (modoBusqueda === 'dia') {
        data = await apifb.fixtures(String(ligaSel.league.id), temporadaFinal, fechaBusqueda);
      } else {
        data = await apifb.fixturesPorSemana(String(ligaSel.league.id), temporadaFinal, fechaDesde, fechaHasta);
      }
      const res: Fixture[] = data.response || [];
      setFixtures(res);
      if (!res.length) {
        Alert.alert(
          'Sin partidos',
          `No hay partidos para:\n• ${ligaSel.league.name}\n• Temporada ${temporadaFinal}\n• ${modoBusqueda==='dia'?`Fecha: ${fechaBusqueda}`:`Del ${fechaDesde} al ${fechaHasta}`}\n\nIntenta con otra fecha o temporada.`
        );
      }
    } catch { Alert.alert('Error','No se pudieron cargar los partidos.'); }
    setLoadingFixtures(false);
  };

  const toggleSel = (id:number) => {
    setSeleccionados(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });
  };

  const importarPartidos = async () => {
    if (seleccionados.size===0) { Alert.alert('Sin selección','Selecciona al menos un partido.'); return; }
    setImportando(true);
    const inserts = fixtures
      .filter(f=>seleccionados.has(f.fixture.id))
      .map(f => ({ local:f.teams.home.name, visitante:f.teams.away.name, fecha:f.fixture.date, jornada:parseInt(jornadaImport), cerrado:false, api_fixture_id:f.fixture.id }));
    const { error } = await supabase.from('partidos').insert(inserts);
    setImportando(false);
    if (error) { Alert.alert('Error al importar', error.message); return; }
    Alert.alert('✅ Importados', `${inserts.length} partido(s) agregados a la Jornada ${jornadaImport}.`);
    setSeleccionados(new Set()); setFixtures([]); setLigaSel(null); setLigas([]);
    setTab('partidos'); cargarDatos();
  };

  // ── Resultados ────────────────────────────────────────────
  const guardarResultado = async () => {
    if (!resultadoInput||!partidoSel) return;
    setSaving(true);
    const { error } = await supabase.from('partidos').update({resultado_final:resultadoInput,cerrado:true}).eq('id',partidoSel.id);
    if (error) { Alert.alert('Error',error.message); setSaving(false); return; }
    await recalcularAciertos(partidoSel.jornada);
    setSaving(false); setModalResultado(false); cargarDatos();
    Alert.alert('✅ Listo','Resultado guardado y aciertos recalculados.');
  };

  const recalcularAciertos = async (jornadaNum:number) => {
    const { data:pJs } = await supabase.from('partidos').select('id,resultado_final').eq('jornada',jornadaNum).not('resultado_final','is',null);
    if (!pJs||!pJs.length) return;
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
  const eliminarPartido = (id:string) => Alert.alert('Eliminar','¿Eliminar este partido?',[{text:'Cancelar',style:'cancel'},{text:'Eliminar',style:'destructive',onPress:async()=>{await supabase.from('partidos').delete().eq('id',id);cargarDatos();}}]);
  const marcarPagado = async (qId:string) => { const{error}=await supabase.from('quinielas').update({estado_pago:'pagado'}).eq('id',qId); if(error)Alert.alert('Error',error.message); else cargarDatos(); };

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.accent} size="large"/></View>;

  const jornadaActual = partidos.find(p=>!p.cerrado)?.jornada??'-';
  const pagados = quinielas.filter(q=>q.estado_pago==='pagado').length;
  const pendientes = quinielas.filter(q=>q.estado_pago==='pendiente').length;
  const statusColor = (s:string) => s==='FT'?C.green:s==='NS'?C.textSub:C.orange;
  const tipoIcon = (t:string) => t==='Cup'?'🏆':'⚽';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS==='ios'?'padding':'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>

      <View style={[styles.header,{paddingTop:insets.top+12}]}>
        <TouchableOpacity onPress={()=>router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text}/>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛡️ Panel Admin</Text>
        <View style={{width:40}}/>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statNum}>{jornadaActual}</Text><Text style={styles.statLabel}>Jornada</Text></View>
        <View style={styles.stat}><Text style={[styles.statNum,{color:C.green}]}>{pagados}</Text><Text style={styles.statLabel}>Pagados</Text></View>
        <View style={styles.stat}><Text style={[styles.statNum,{color:C.orange}]}>{pendientes}</Text><Text style={styles.statLabel}>Pendientes</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{quinielas.length}</Text><Text style={styles.statLabel}>Total</Text></View>
      </View>

      <View style={styles.tabs}>
        {(['partidos','importar','quinielas'] as TabAdmin[]).map(t=>(
          <TouchableOpacity key={t} style={[styles.tabBtn,tab===t&&styles.tabActivo]} onPress={()=>setTab(t)}>
            <Text style={[styles.tabTexto,tab===t&&styles.tabTextoActivo]}>
              {t==='partidos'?'⚽ Partidos':t==='importar'?'📡 Importar':'📋 Quinielas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{flex:1}}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{paddingBottom: insets.bottom + 40}}
      >
        {/* ── TAB PARTIDOS ── */}
        {tab==='partidos' && (
          <>
            <TouchableOpacity style={styles.btnAgregar} onPress={()=>setModalPartido(true)} activeOpacity={0.8}>
              <Ionicons name="add-circle" size={20} color={C.textSub}/>
              <Text style={styles.btnAgregarTexto}>Agregar partido manualmente</Text>
            </TouchableOpacity>
            {partidos.length===0
              ? <View style={styles.emptyBox}><Text style={styles.emptyText}>No hay partidos. Importa desde la API o agrega manualmente.</Text></View>
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

        {/* ── TAB IMPORTAR ── */}
        {tab==='importar' && (
          <View style={{padding:16}}>

            {/* Paso 1 — Buscar */}
            <View style={styles.pasoCard}>
              <View style={styles.pasoNumWrap}><Text style={styles.pasoNum}>1</Text></View>
              <View style={{flex:1}}>
                <Text style={styles.pasoTitulo}>Buscar liga o copa</Text>
                <Text style={styles.hint}>Ej: Liga MX Apertura, FIFA World Cup, Champions League</Text>
                <View style={styles.searchRow}>
                  <TextInput
                    style={[styles.input,{flex:1,marginBottom:0}]}
                    value={busquedaLiga}
                    onChangeText={setBusquedaLiga}
                    placeholder="Liga MX Apertura..."
                    placeholderTextColor="#555577"
                    onSubmitEditing={buscarLigas}
                    returnKeyType="search"
                  />
                  <TouchableOpacity style={styles.btnSearch} onPress={buscarLigas} activeOpacity={0.8}>
                    {loadingLigas
                      ? <ActivityIndicator color="#fff" size="small"/>
                      : <Ionicons name="search" size={18} color="#fff"/>}
                  </TouchableOpacity>
                </View>

                {ligas.length>0 && (
                  <View style={styles.ligasLista}>
                    {ligas.map(l=>{
                      const t = mejorTemporada(l.seasons);
                      return (
                        <TouchableOpacity key={l.league.id} style={[styles.ligaRow,ligaSel?.league.id===l.league.id&&styles.ligaRowActiva]} onPress={()=>seleccionarLiga(l)} activeOpacity={0.7}>
                          <Text style={styles.ligaTipo}>{tipoIcon(l.league.type)}</Text>
                          <View style={{flex:1,marginLeft:8}}>
                            <Text style={styles.ligaNombre}>{l.league.name}</Text>
                            <Text style={styles.ligaPais}>{l.country.name} · {l.league.type} · {t}</Text>
                          </View>
                          {ligaSel?.league.id===l.league.id && <Ionicons name="checkmark-circle" size={20} color={C.accent}/>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* Paso 2 — Temporada y fecha */}
            {ligaSel && (
              <View style={styles.pasoCard}>
                <View style={styles.pasoNumWrap}><Text style={styles.pasoNum}>2</Text></View>
                <View style={{flex:1}}>
                  <Text style={styles.pasoTitulo}>{ligaSel.league.name}</Text>

                  {/* Temporadas rápidas */}
                  <Text style={styles.label}>Temporada</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>
                    <View style={{flexDirection:'row',gap:6}}>
                      {[...ligaSel.seasons].sort((a,b)=>b.year-a.year).slice(0,6).map(s=>(
                        <TouchableOpacity
                          key={s.year}
                          style={[styles.temporadaBtn, temporadaFinal===String(s.year)&&styles.temporadaBtnActiva]}
                          onPress={()=>setTemporadaManual(String(s.year))}
                        >
                          <Text style={[styles.temporadaTexto, temporadaFinal===String(s.year)&&{color:C.accent}]}>
                            {s.year}{s.current?' ⭐':''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Ingreso manual de temporada */}
                  <Text style={styles.label}>O escribe el año</Text>
                  <TextInput
                    style={styles.input}
                    value={temporadaManual}
                    onChangeText={setTemporadaManual}
                    keyboardType="number-pad"
                    placeholder="2025"
                    placeholderTextColor="#555577"
                    maxLength={4}
                  />

                  {/* Modo búsqueda */}
                  <View style={styles.modoRow}>
                    <TouchableOpacity style={[styles.modoBtn,modoBusqueda==='dia'&&styles.modoBtnActivo]} onPress={()=>setModoBusqueda('dia')}>
                      <Text style={[styles.modoBtnTexto,modoBusqueda==='dia'&&{color:C.accent}]}>Por día</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modoBtn,modoBusqueda==='semana'&&styles.modoBtnActivo]} onPress={()=>setModoBusqueda('semana')}>
                      <Text style={[styles.modoBtnTexto,modoBusqueda==='semana'&&{color:C.accent}]}>Por semana</Text>
                    </TouchableOpacity>
                  </View>

                  {modoBusqueda==='dia' ? (
                    <><Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
                    <TextInput style={styles.input} value={fechaBusqueda} onChangeText={setFechaBusqueda} placeholder="2025-04-05" placeholderTextColor="#555577"/></>
                  ) : (
                    <><Text style={styles.label}>Desde</Text>
                    <TextInput style={styles.input} value={fechaDesde} onChangeText={setFechaDesde} placeholder="2025-04-01" placeholderTextColor="#555577"/>
                    <Text style={styles.label}>Hasta</Text>
                    <TextInput style={styles.input} value={fechaHasta} onChangeText={setFechaHasta} placeholder="2025-04-07" placeholderTextColor="#555577"/></>
                  )}

                  <TouchableOpacity style={styles.btnBuscarFixtures} onPress={buscarFixtures} activeOpacity={0.8}>
                    {loadingFixtures
                      ? <ActivityIndicator color="#fff" size="small"/>
                      : <><Ionicons name="football" size={16} color="#fff"/><Text style={styles.btnBuscarFixturesTexto}>Ver partidos</Text></>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Paso 3 — Seleccionar */}
            {fixtures.length>0 && (
              <View style={styles.pasoCard}>
                <View style={styles.pasoNumWrap}><Text style={styles.pasoNum}>3</Text></View>
                <View style={{flex:1}}>
                  <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                    <Text style={styles.pasoTitulo}>{fixtures.length} partidos encontrados</Text>
                    <TouchableOpacity onPress={()=>{
                      if (seleccionados.size===fixtures.length) setSeleccionados(new Set());
                      else setSeleccionados(new Set(fixtures.map(f=>f.fixture.id)));
                    }}>
                      <Text style={{color:C.accent,fontSize:12,fontWeight:'700'}}>
                        {seleccionados.size===fixtures.length?'Quitar todos':'Todos'}
                      </Text>
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
              </View>
            )}

            {/* Paso 4 — Crear quiniela */}
            {seleccionados.size>0 && (
              <View style={styles.pasoCard}>
                <View style={styles.pasoNumWrap}><Text style={styles.pasoNum}>4</Text></View>
                <View style={{flex:1}}>
                  <Text style={styles.pasoTitulo}>Crear quiniela</Text>
                  <Text style={styles.label}>Número de jornada</Text>
                  <TextInput style={styles.input} value={jornadaImport} onChangeText={setJornadaImport} keyboardType="number-pad" placeholderTextColor="#555577"/>
                  <TouchableOpacity style={[styles.btnImportar,importando&&{opacity:0.6}]} onPress={importarPartidos} disabled={importando} activeOpacity={0.8}>
                    {importando
                      ? <ActivityIndicator color="#fff"/>
                      : <><Ionicons name="cloud-upload" size={18} color="#fff"/><Text style={styles.btnImportarTexto}>Crear Jornada {jornadaImport} ({seleccionados.size} partidos)</Text></>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── TAB QUINIELAS ── */}
        {tab==='quinielas' && (
          quinielas.length===0
            ? <View style={styles.emptyBox}><Text style={styles.emptyText}>No hay quinielas registradas aún.</Text></View>
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

      {/* ── Modal partido manual ── */}
      <Modal visible={modalPartido} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitulo}>Nuevo partido</Text>
              <ScrollView keyboardShouldPersistTaps="handled">
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

      {/* ── Modal resultado ── */}
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
            <Text style={styles.infoAciertos}>⚡ Se recalculan los aciertos automáticamente</Text>
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
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingBottom:16,backgroundColor:C.bg},
  backBtn:{padding:6,borderRadius:10,backgroundColor:C.card},
  headerTitle:{color:C.text,fontSize:18,fontWeight:'bold'},
  statsRow:{flexDirection:'row',backgroundColor:C.card,marginHorizontal:16,borderRadius:14,padding:16,marginBottom:8,borderWidth:1,borderColor:C.cardBorder},
  stat:{flex:1,alignItems:'center'},
  statNum:{color:C.accent,fontSize:24,fontWeight:'bold'}, statLabel:{color:C.textSub,fontSize:11,marginTop:2},
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
  emptyBox:{margin:16,padding:20,backgroundColor:C.card,borderRadius:12,alignItems:'center',borderWidth:1,borderColor:C.cardBorder},
  emptyText:{color:C.textSub,fontSize:14,textAlign:'center'},
  hint:{color:C.textSub,fontSize:11,marginBottom:10,fontStyle:'italic'},
  pasoCard:{backgroundColor:C.card,borderRadius:14,padding:16,marginBottom:12,borderWidth:1,borderColor:C.cardBorder,flexDirection:'row',gap:12},
  pasoNumWrap:{width:28,height:28,borderRadius:14,backgroundColor:C.accentDim,borderWidth:1,borderColor:C.accent,justifyContent:'center',alignItems:'center'},
  pasoNum:{color:C.accent,fontWeight:'bold',fontSize:14},
  pasoTitulo:{color:C.text,fontWeight:'bold',fontSize:14,marginBottom:12},
  searchRow:{flexDirection:'row',gap:8},
  btnSearch:{backgroundColor:C.accent,paddingHorizontal:14,paddingVertical:12,borderRadius:10,justifyContent:'center',alignItems:'center'},
  ligasLista:{marginTop:10,borderRadius:10,borderWidth:1,borderColor:C.cardBorder,maxHeight:250},
  ligaRow:{flexDirection:'row',alignItems:'center',padding:12,borderBottomWidth:1,borderBottomColor:C.cardBorder},
  ligaRowActiva:{backgroundColor:C.accentDim},
  ligaTipo:{fontSize:18},
  ligaNombre:{color:C.text,fontWeight:'600',fontSize:13},
  ligaPais:{color:C.textSub,fontSize:11,marginTop:2},
  temporadaBtn:{paddingHorizontal:14,paddingVertical:7,borderRadius:20,borderWidth:1.5,borderColor:C.cardBorder,backgroundColor:'#12121f'},
  temporadaBtnActiva:{borderColor:C.accent,backgroundColor:C.accentDim},
  temporadaTexto:{color:C.textSub,fontWeight:'700',fontSize:12},
  modoRow:{flexDirection:'row',gap:8,marginBottom:12},
  modoBtn:{flex:1,padding:9,borderRadius:10,borderWidth:1.5,borderColor:C.cardBorder,alignItems:'center'},
  modoBtnActivo:{borderColor:C.accent,backgroundColor:C.accentDim},
  modoBtnTexto:{color:C.textSub,fontWeight:'600',fontSize:13},
  btnBuscarFixtures:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.accent,padding:13,borderRadius:10,marginTop:4},
  btnBuscarFixturesTexto:{color:'#fff',fontWeight:'bold',fontSize:14},
  fixtureRow:{flexDirection:'row',alignItems:'center',padding:12,borderRadius:10,marginBottom:6,borderWidth:1.5,borderColor:C.cardBorder,backgroundColor:'#12121f'},
  fixtureRowSel:{borderColor:C.accent,backgroundColor:C.accentDim},
  checkbox:{width:22,height:22,borderRadius:6,borderWidth:2,borderColor:C.textSub,justifyContent:'center',alignItems:'center'},
  checkboxSel:{backgroundColor:C.accent,borderColor:C.accent},
  fixtureEquipos:{color:C.text,fontWeight:'600',fontSize:13},
  fixtureFecha:{color:C.textSub,fontSize:11,marginTop:2},
  statusBadge:{borderWidth:1.5,borderRadius:6,paddingHorizontal:6,paddingVertical:2},
  statusTexto:{fontSize:10,fontWeight:'700'},
  btnImportar:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.green,padding:15,borderRadius:12,marginTop:4},
  btnImportarTexto:{color:'#fff',fontWeight:'bold',fontSize:15},
  modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.7)',justifyContent:'flex-end'},
  modalCard:{backgroundColor:C.card,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,borderTopWidth:1,borderColor:C.cardBorder},
  modalTitulo:{fontSize:18,fontWeight:'bold',color:C.text,marginBottom:4},
  modalSubtitulo:{fontSize:13,color:C.textSub,marginBottom:16},
  label:{fontSize:13,fontWeight:'600',color:C.textSub,marginBottom:5,marginTop:2},
  input:{borderWidth:1.5,borderColor:C.cardBorder,borderRadius:10,padding:12,marginBottom:10,fontSize:14,color:C.text,backgroundColor:'#12121f'},
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
