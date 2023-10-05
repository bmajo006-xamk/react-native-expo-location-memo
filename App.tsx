import {useState, useEffect} from 'react';
import { StyleSheet, ScrollView, Image, useWindowDimensions} from 'react-native';
import {FAB, Dialog, Portal, Provider, TextInput, Button, Card, Paragraph, IconButton} from 'react-native-paper';
import * as SQLite from 'expo-sqlite';
import * as Location from 'expo-location';
import { SQLTransaction } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';


//globaali muuttuja, parametriksi tiedoston nimi
const db : SQLite.WebSQLDatabase = SQLite.openDatabase("sijannit.db");

db.transaction( 
  (tx : SQLTransaction) => {
    tx.executeSql(`CREATE TABLE IF NOT EXISTS sijainnit (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  tunnisteteksti TEXT,
                  ohjeistusteksti TEXT,
                  lat FLOAT,
                  lon FLOAT,
                  pvm TEXT,
                  kellonaika TEXT,
                  lisatty BOOLEAN,
                  kuva VARCHAR
                  )`);
  }, 
  (err : SQLite.SQLError) => {
    console.log(err);
  })

interface Sijainti {
  id : number
  tunnisteteksti: string
  ohjeistusteksti : string
  lat : number
  lon: number
  pvm : number
  kellonaika : string
  lisatty : boolean
  kuva : string
}

interface Sijaintikoordinaatit {
  latitude : number
  longitude : number
}

interface Dialogi {
  nayta : boolean
  tunniste : string
  ohjeistus : string
}

const App : React.FC = () : React.ReactElement => {

  const [sijainnit, setSijainnit] = useState<Sijainti[]>([]);
  const [sijainti_coord, setSijainti_coord] = useState<Sijaintikoordinaatit>({
                                  latitude: 0,
                                  longitude: 0
                                  });
  const [uusiSijaintiDialogi, setUusiSijaintiDialogi] = useState<Dialogi>({
                                                      nayta : false,
                                                      tunniste: "", 
                                                      ohjeistus: ""
                                                    })
  const [poistaDialogi, setPoistaDialogi] = useState<boolean>(false);
  const [poistettavaId, setPoistettavaId] = useState<number>();
  const { width } = useWindowDimensions(); 


  
  const haeSijainnit = () : void => {

    db.transaction(

      (tx : SQLite.SQLTransaction) => {

        tx.executeSql(`SELECT * FROM sijainnit`, [],
                                              (_tx : SQLite.SQLTransaction, rs : SQLite.SQLResultSet) => {
                                                setSijainnit(rs.rows._array);
                                              });
      },
      (err : SQLite.SQLError) => {
        console.log(err);
      }
    )
  }
  const lisaaSijainti = () : void => {

    let paiva = new Date();
    let paivam =  paiva.getDay() + "." + (paiva.getMonth()+1) + "." + paiva.getFullYear();
    let klonaika =  paiva.toLocaleTimeString('en-US', {hour12 : false});
    haeSijaintiTiedot();
    
    let lisatty = 1;
    db.transaction(

      (tx) => {

        tx.executeSql(`INSERT INTO sijainnit (tunnisteteksti, ohjeistusteksti, lat, lon, pvm, kellonaika, lisatty) VALUES (?, ?, ?, ?, ?,?, ?)`, 
                      [uusiSijaintiDialogi.tunniste, uusiSijaintiDialogi.ohjeistus, sijainti_coord.latitude, sijainti_coord.longitude, paivam, klonaika, lisatty],
                                              (_tx : SQLite.SQLTransaction , rs : SQLite.SQLResultSet) => {
                                                haeSijainnit();
                                                console.log(rs);
                                              });
      },
      (err : SQLite.SQLError) => {
        console.log(err);
      }
    )
    setUusiSijaintiDialogi({
      ...uusiSijaintiDialogi,
      nayta : false
      })
   
  }

  const poistaSijainti = (id?: number) : void => {
  
    db.transaction(
      (tx : SQLite.SQLTransaction) => {

        tx.executeSql(`DELETE FROM sijainnit WHERE id = ${id}`, [],
                                              (_tx : SQLite.SQLTransaction, rs : SQLite.SQLResultSet) => {
                                                haeSijainnit();
                                              });                            
      },
      (err : SQLite.SQLError) => {
        console.log(err);
      }
    )
  }

  const valitseKuvat = async (id : number) => {

    let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        selectionLimit: 10,
        aspect: [4, 3],
        quality: 1,
    });


    if (!result.cancelled) {
      lisaaKuva(result.uri, id);

    }
  };

  const lisaaKuva = (uri: string, id: number) => {

    db.transaction(

      (tx) => {

      tx.executeSql(`UPDATE sijainnit SET kuva="${uri}" WHERE id= ${id}`,[],
                                              (_tx : SQLite.SQLTransaction , rs : SQLite.SQLResultSet) => {
                                                haeSijainnit();
                                              });
                                            
      },
      (err : SQLite.SQLError) => {
        console.log(err);
      }
    )
  }

  const haeSijaintiTiedot = async () => {
   
      let {status} = await Location.requestForegroundPermissionsAsync();
    
      if (status === 'granted'){
        let sijainti_nyt = await Location.getCurrentPositionAsync({});
        JSON.stringify(sijainti_nyt);
        setSijainti_coord({
          latitude: sijainti_nyt.coords.latitude,
          longitude: sijainti_nyt.coords.longitude
        })
      }
  }

  useEffect( () => {
    haeSijaintiTiedot();
    haeSijainnit();
  }, [])

  return (
    <Provider>
        <ScrollView style={styles.container}>
              { (sijainnit.length > 0) ?
                sijainnit?.map((sijainti, idx: number) => {
                return(
                <Card 
                  key={idx} 
                  mode= 'contained' 
                  style={{top: 30, minHeight: 500, padding: 10}}>
                  <Card.Title 
                      title={sijainti.tunnisteteksti}
                      titleVariant='titleLarge'
                      right={() => <IconButton icon="delete" onPress={() => {
                                                                setPoistaDialogi(true)
                                                                setPoistettavaId(sijainti.id) 
                                                                  }} />}/>
                    <Card.Content>
                      <Paragraph>{sijainti.ohjeistusteksti}</Paragraph>
                      <Paragraph>Koordinaatit: {sijainti.lat} (lat), {sijainti.lon} (lon) </Paragraph>
                      <Paragraph>Päivämäärä: {sijainti.pvm}</Paragraph>
                      <Paragraph>Kellonaika: {sijainti.kellonaika}</Paragraph>
                      { (sijainti.kuva) ?
                      <Image source={{ uri: sijainti.kuva }} style={{ width: width-45, height: 200,  top: 20, bottom: 10 }}/> 
                      : null
                      }
                    </Card.Content>
                    <Card.Actions
                        style={styles.buttons}>
                      { (sijainti.lisatty) ? 
                      <Button
                        icon="image"
                        onPress= { () => {valitseKuvat(sijainti.id)}}
                      >Lisää kuva</Button>
                      : null
                      }
                    </Card.Actions>
                </Card>)
                })
          
              : null

              }
        
        </ScrollView>
          <FAB
            icon="plus"
            label="Lisää uusi"
            style={styles.fab}
            onPress = { () => {setUusiSijaintiDialogi({
                              ...uusiSijaintiDialogi,
                              nayta : true,
                              tunniste : "",
                              ohjeistus : ""
                              });
                      }}
          />
      <Portal>
        <Dialog style={{height: 350}} visible={uusiSijaintiDialogi.nayta} onDismiss = {() => {setUusiSijaintiDialogi({...uusiSijaintiDialogi, nayta : false})}}>
          <Dialog.Title>Lisää uusi sijainti: </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Sijainnin tunnisteteksti:"
              style={styles.textinput_eka}
              onChangeText={tunnisteTeksti => setUusiSijaintiDialogi({
                                              ...uusiSijaintiDialogi,
                                              tunniste: tunnisteTeksti

                                              })}
            />
            <TextInput
              label="Ohjeistusteksti:"
              style={styles.textinput_toka}
              onChangeText={ohjeistusTeksti => setUusiSijaintiDialogi({
                                                ...uusiSijaintiDialogi,
                                                ohjeistus: ohjeistusTeksti
                                                })}
            />
            <Button
              mode="contained"
              style={{top: 20, bottom: 40}}
              onPress={() => {
                lisaaSijainti();
                }}>Lisää
            </Button>
            <Button
              mode= "outlined"
              style={{top: 30, bottom: 20}}
              onPress={() => {
                setUusiSijaintiDialogi({
                  ...uusiSijaintiDialogi,
                  nayta : false             
                })}}>Peruuta</Button>
          </Dialog.Content>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog 
          visible= {poistaDialogi} 
          onDismiss = {() => {setPoistaDialogi(false)}}>
          <Dialog.Actions>
              <Button
                onPress = { () => {
                        poistaSijainti(poistettavaId)
                        setPoistaDialogi(false)}}
                >Vahvista poistaminen</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 2,
    top: 40
  
  },
  card: {
    width: '80%',
    bottom: 30
  },
  fab : {
    width: '85%',
    left: 30,
    top: -30
  },
  buttons: {
    top: 35,
    left: -225,
    padding: -10
  },
  textinput_eka : {
    minHeight: 60

  },
  textinput_toka : {
    minHeight: 80

  }
});
export default App;
