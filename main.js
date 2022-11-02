import './style.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import {transform} from "ol/proj";

let stopSearch = true;
let firstLoad = true;
let lastSearch = false;

navigator.geolocation.getCurrentPosition(coordsSet, coordsFailed, {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
});

function coordsSet(pos) {
    console.log(pos.coords)

    const lat = pos.coords.latitude
    const lon = pos.coords.longitude
    console.log(lat, lon)
        // 29.55805
    if (lon < 29.28 || lon > 33.20 || lat > 35.54 || lat < 34.2675131) {
        console.log('not in Israel')
        firstLoad = false;
        map.getView().setCenter(transform([35.21525804388815, 31.775488166069692], 'EPSG:4326', 'EPSG:3857'))
    }
    else {
        firstLoad = false;
        map.getView().setCenter(transform([lon, lat], 'EPSG:4326', 'EPSG:3857'))
    }
}

function  coordsFailed() {
    firstLoad = false;
    map.getView().setCenter(transform([35.21525804388815, 31.775488166069692], 'EPSG:4326', 'EPSG:3857'))
}

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM()
    })
  ],
  view: new View({
    center: transform([0.0], 'EPSG:4326', 'EPSG:3857'),
    zoom: 18
  })
});

let imagesFound = false;

async function geoCode(lat, lon) {

    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Host': 'forward-reverse-geocoding.p.rapidapi.com'
        }
    };

    await fetch(`https://forward-reverse-geocoding.p.rapidapi.com/v1/reverse?lat=${lat}&lon=${lon}&accept-language=he&polygon_threshold=0.0`, options)
        .then((r) => r.json()).then( data => {
            // console.log(data)
            const isWb = data['address']['country_code'] == "ps"
            let placeArray = []
            if (data['address']['suburb']) placeArray.push(
                generateNliKeyword(data['address']['suburb'], isWb)
            )
            if (data['address']['neighbourhood']) placeArray.push(
                generateNliKeyword(data['address']['neighbourhood'], isWb)
            )
            if (data['address']['village']) placeArray.push(
                generateNliKeyword(data['address']['village'], isWb)
            )
            if (data['address']['town']) placeArray.push(
                generateNliKeyword(data['address']['town'], isWb)
            )
            if (data['address']['city']) placeArray.push(
                generateNliKeyword(data['address']['city'], isWb)
            )
            if (data['address']['state_district']) placeArray.push(
                generateNliKeyword(data['address']['state_district'], isWb)
                )
            document.querySelector("#nli_images").innerHTML = ""
            getNLI(placeArray)
      })
}

function generateNliKeyword(place, isWb) {
    place = place.replace("Regional Council", "")
        .replace("Subdistrict", "")
        .replace("District", "")
        .replace("נפת", "")
        .replace("מחוז", "")

    return `${place}`.trim()

    // return `${place}*(${isWb ? "West Bank": "Israel"})*`.trim()
    // return `${place}*(${isWb ? "יהודה ושומרון": "ישראל"})*`.trim()

}


function getBoundingBox(centerPoint, distance) {
    //distance is in km
    let MIN_LAT, MAX_LAT, MIN_LON, MAX_LON, R, radDist, degLat, degLon, radLat, radLon, minLat, maxLat, minLon, maxLon, deltaLon;
    if (distance < 0) {
        return 'Illegal arguments';
    }
    // helper functions (degrees<–>radians)
    Number.prototype.degToRad = function () {
        return this * (Math.PI / 180);
    };
    Number.prototype.radToDeg = function () {
        return (180 * this) / Math.PI;
    };
    // coordinate limits
    MIN_LAT = (-90).degToRad();
    MAX_LAT = (90).degToRad();
    MIN_LON = (-180).degToRad();
    MAX_LON = (180).degToRad();
    // Earth's radius (km)
    R = 6378.1;
    // angular distance in radians on a great circle
    radDist = distance / R;
    // center point coordinates (deg)
    degLat = centerPoint[0];
    degLon = centerPoint[1];
    // center point coordinates (rad)
    radLat = degLat.degToRad();
    radLon = degLon.degToRad();
    // minimum and maximum latitudes for given distance
    minLat = radLat - radDist;
    maxLat = radLat + radDist;
    // minimum and maximum longitudes for given distance
    minLon = void 0;
    maxLon = void 0;
    // define deltaLon to help determine min and max longitudes
    deltaLon = Math.asin(Math.sin(radDist) / Math.cos(radLat));
    if (minLat > MIN_LAT && maxLat < MAX_LAT) {
        minLon = radLon - deltaLon;
        maxLon = radLon + deltaLon;
        if (minLon < MIN_LON) {
            minLon = minLon + 2 * Math.PI;
        }
        if (maxLon > MAX_LON) {
            maxLon = maxLon - 2 * Math.PI;
        }
    }
    // a pole is within the given distance
    else {
        minLat = Math.max(minLat, MIN_LAT);
        maxLat = Math.min(maxLat, MAX_LAT);
        minLon = MIN_LON;
        maxLon = MAX_LON;
    }
    return [
        minLon.radToDeg(),
        minLat.radToDeg(),
        maxLon.radToDeg(),
        maxLat.radToDeg()
    ];
};

async function getImageDataFromNLI(url_req, kw=null) {
        await fetch(url_req)
            .then((r) => r.text())
            .then(str => new window.DOMParser().parseFromString(str, "text/xml"))
            .then( xmlDoc => {

                const recordsCount = xmlDoc.getElementsByTagName("numberOfRecords")[0].childNodes[0].nodeValue;
                if (recordsCount == 0) {
                  document.querySelector("#placename").innerHTML = ""


                   if (lastSearch && document.querySelectorAll(".nliimages").length === 0) {
                       if (kw) {
                           getNLI(kw)
                       }
                       else {
                           const latLon = transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326')
                           geoCode(latLon[1], latLon[0])
                           lastSearch = false
                       }
                   }


                  return true

                }
                else {
                    const records = xmlDoc.querySelector("records").querySelectorAll("recordData")

                    records.forEach(record => {
                        const tag907 = record.querySelector("[*|tag='907']")
                        const tag245 = record.querySelector("[*|tag='245']")
                        let titleString = ""
                        if (tag245) {titleString = titleString + `${tag245.querySelector("[*|code='a']").innerHTML} `}
                        if (tag907 && tag907.querySelector("[*|code='d']")) {
                            const image = document.createElement('img')
                            image.className = "nliImage"
                            image.src  = `https://rosetta.nli.org.il/delivery/DeliveryManagerServlet?dps_func=stream&dps_pid=${tag907.querySelector("[*|code='d']").innerHTML}`

                            image.title = titleString

                            document.querySelector('#nli_images').appendChild(image);
                            document.querySelector("#placename").innerHTML = ""
                            return true
                        }
                        else {
                          return true
                        }
                    });





                }
            })

}



async function getPOIs(mapCenter, radius) {


    const bbox = getBoundingBox(mapCenter, radius);
    const bbox_str = `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`;
    const query = encodeURI(`data=[out:json][timeout:2];
        (
            node["historic"](${bbox_str});
            way["historic"](${bbox_str});
            relation["historic"](${bbox_str});
            
            node["building"="public"](${bbox_str});
            way["building"="public"](${bbox_str});
            relation["building"="public"](${bbox_str});

            node["building"="hospital"](${bbox_str});
            way["building"="hospital"](${bbox_str});
            relation["building"="hospital"](${bbox_str});
            
            node["natural"="peak" ](${bbox_str});
            way["natural"="peak" ](${bbox_str});
            relation["natural"="peak" ](${bbox_str});

            node["tourism"="viewpoint"](${bbox_str});
            way["tourism"="viewpoint"](${bbox_str});
            relation["tourism"="viewpoint"](${bbox_str});

                       
        )
        ;out+body;>;out+skel+qt;`);

    document.querySelector("#placename").innerHTML = "מחפש מיקומים מעניינים..."
    document.querySelector("#nli_images").innerHTML = ""

    await fetch("https://overpass-api.de/api/interpreter", {
        "body": query,
        "method": "POST",
    }).then((r) => r.json()).then( data => {
        // console.log(data)
        const blacklist = [
            "גת",
            "מערת קבורה",
            "ספריה עירונית",
            "War Memorial"
        ]
        if (data.elements.length === 0) {
            document.querySelector('#placename').innerHTML = `לצערנו, לא נמצאו נקודות עניין ברדיוס של ${radius} ק״מ`;
            const latLon = transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326')
            geoCode(latLon[1], latLon[0])
        }

        let pois = []

        lastSearch = false
        data.elements.every((poi, i) => {
            document.querySelector("#placename").innerHTML = "מחפש מיקומים מעניינים..."

            console.log(poi)
            if (poi.tags) {
                if (poi.tags.name && !blacklist.includes(poi.tags.name)) {
                   console.log(poi.tags.name)
                  pois.push(poi.tags.name)

                  const url = new URL("https://eu01.alma.exlibrisgroup.com/view/sru/972NNL_INST")
                  const params = {
                      version: 1.2,
                      operation: 'searchRetrieve',
                      recordSchema: 'marcxml',
                      query: encodeURI(`alma.all_for_ui="${poi.tags.name}" and alma.local_field_999="PHOTOGRAPH" local_field_903="No restrictions" sortBy alma.main_pub_date/sort.ascending`),
                      maximumRecords: 20
                  }
                  url.search = new URLSearchParams(params)

                  console.log(poi.tags.name)

                  document.querySelector('#placename').innerHTML = `מחפש תוצאות עבור ${poi.tags.name}`;

                  if (i+1 === data.elements.length) {
                      lastSearch = true
                  }

                  return getImageDataFromNLI(url)

                }
                else {
                  if (i+1 === data.elements.length && document.querySelectorAll(".nliimages").length === 0) {
                    const latLon = transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326')
                    geoCode(latLon[1], latLon[0])
                  }
                  return true
                }
            }
        })

        console.log('done')


    })

}

async function getNLI(keywords) {
    document.querySelector("#placename").innerHTML = "טוען..."
    if (stopSearch || keywords.length === 0) {
        return
    }
    // const keyword = generateNliKeyword(placeArray.shift(), isWb)

    const keyword = keywords.shift()

    // console.log(keyword)

    const url = new URL("https://eu01.alma.exlibrisgroup.com/view/sru/972NNL_INST")
    const params = {
        version: 1.2,
        operation: 'searchRetrieve',
        recordSchema: 'marcxml',
        query: encodeURI(`alma.all_for_ui="${keyword}" and alma.local_field_999="PHOTOGRAPH" local_field_903="No restrictions" sortBy alma.main_pub_date/sort.ascending`),
        maximumRecords: 7
    }
    url.search = new URLSearchParams(params)

    document.querySelector('#placename').innerHTML = `מחפש תוצאות עבור ${keyword}`;

    lastSearch = true
    getImageDataFromNLI(url, keywords)


}

async function getTexts(latlon) {
    document.querySelector('#mekoros').innerHTML = "";
    const lat = latlon[0];
    const lon = latlon[1];
    await fetch(`https://geo-api.cauldron.sefaria.org/api/geo?lat=${lat}&lon=${lon}`)
        .then((r) => r.json()).then(data => {
            console.log(data)

            for (let [key, value] of Object.entries(data)) {
                console.log(key, value);
                const title = document.createElement('div')
                title.className = "title"
                title.innerHTML = value["heRef"]
                document.querySelector('#mekoros').appendChild(title);

                const text = document.createElement('div')
                text.classList.add("text", "clamped")
                text.innerHTML = value["he"]
                document.querySelector('#mekoros').appendChild(text);


            }
                //
                //
                // image.title = titleString
                //
                // document.querySelector("#placename").innerHTML = ""
                // return true

        })
}

let debounce
function onMoveStart(evt) {
    document.querySelector("#nli_images").innerHTML = ""
    clearTimeout(debounce);
    fetch("https://overpass-api.de/api/kill_my_queries")
    stopSearch = true
}

function onMoveEnd(evt) {
    if (firstLoad) {
        firstLoad = false;
        return
    }
    stopSearch = false
    const map = evt.map;
    const latLon = transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326')

    debounce = setTimeout(

    function () {
        getPOIs(latLon, .5)
        getTexts(latLon)

    }, 1000);
    // console.log(latLon)
    // console.log(getBoundingBox(latLon, 2))
}

map.on('moveend', onMoveEnd);
map.on('movestart', onMoveStart);

document.querySelector('#nli_images').addEventListener('click', (e) => {
  if (e.target.tagName.toLowerCase() === 'img') {
    console.log(`${e.target.title}: ${e.target.src}`)

    document.querySelector('#image_det').src = e.target.src;
    document.querySelector('#caption').innerHTML = e.target.title;
    document.querySelector('#detail').style.display = "block";
  }
});


document.querySelector('#mekoros').addEventListener('click', (e) => {
    if (e.target.classList.contains('clamped') ) {
        const allText = document.querySelectorAll('.text')
        allText.forEach((el) => {
            el.classList.add("clamped")
        })

        e.target.classList.remove('clamped')
    }


});


document.querySelector('#detail').addEventListener('click', (e) => {
    document.querySelector('#detail').style.display = "none";
});
