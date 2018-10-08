'''
This program supposed that you have a running PostGIS database, with admin0 naturalearth data already inserted into
It will extract for each country the corresponding geojson, and convert it into a lexical tree of geohashes representing the country
These trees are ready to insert in the dedicated ethereum countries smart contract

PostGIS configuration has to be written in a 'config.ini' file in the same folder as the python script, wit the following content:

[POSTGIS]
db=YOUR_DATABASE
user=YOUR_USER
host=YOUR_HOST
password=YOUR_PASSWORD
ne_schema=NATURALEARTH_SCHEMA
admin0_table=ADMIN0_TABLE
countrycode=iso_a3

'''

from polygon_geohasher.polygon_geohasher import polygon_to_geohashes, geohash_to_polygon, geohashes_to_polygon
from shapely import geometry
from shapely.geometry import shape
import geojson
import json
import os
import configparser
import sys
import psycopg2
import pycountry

def append_word(tree, word):
    if len(word):
        char = word[0]
        if not char in tree:
            tree[char] = {}
        append_word(tree[char], word[1:])

def make_tree(tree, words):
    for w in words:
        append_word(tree, w)

def dump_tree2(tree, indent=0, level=0):
    array_char = []
    for c in tree.keys():
        print(" " * indent + c + "          level " + str(level))
        array_char.append(c)
        dump_tree2(tree[c], indent + 2, level+1)

def print_tree(tree):
    print(json.dumps(tree))

def write_tree(tree, name, folder):
    with open(os.path.join(folder, name + '.json'), 'w') as outfile:
        print('Writing {name}.json in {folder}'.format(name=name, folder=folder))
        json.dump(tree, outfile, indent=4)

def build_mapping_stuff(tree):
    pass


if __name__ == '__main__':

    CONFIG_PATH = './config.ini'
    GEOJSON_PATH = '/tmp/geojsons'
    TREES_PATH = './trees_countries'

    config = configparser.ConfigParser()
    config.read(CONFIG_PATH)
    dbname = config['POSTGIS']['db']
    dbuser = config['POSTGIS']['user']
    dbpass = config['POSTGIS']['password']
    dbhost = config['POSTGIS']['host']
    schema = config['POSTGIS']['ne_schema']
    table = config['POSTGIS']['admin0_table']
    code = config['POSTGIS']['countrycode']

    try:
        # Connect to an existing database
        conn = psycopg2.connect("dbname='{dbname}' user='{dbuser}' host='{dbhost}' password='{dbpass}'".format(dbname=dbname, dbuser=dbuser, dbhost=dbhost, dbpass=dbpass))
    except:

        sys.stdout.write("I am unable to connect to the database")
        exit(0)


    # Open a cursor to perform database operations
    cur = conn.cursor()
    cur.execute("""SELECT {column} FROM {naturalearth}.{admin0}""".format(column=code, naturalearth=schema, admin0=table))
    adm0_a3s_raw = cur.fetchall()

    adm0_a3s = list(set([item[0] for item in adm0_a3s_raw])) # remove duplicated countrycodes
    print(adm0_a3s)

    not_supported = ['-99'] # TODO: check missing countries

    if not os.path.exists(GEOJSON_PATH):
        os.makedirs(GEOJSON_PATH)

    for code3 in adm0_a3s:
        if code3 in not_supported:
            print('{} not supported'.format(code3))
        else:
            print(code3)
            current_country = pycountry.countries.get(alpha_3=code3)
            code2 = current_country.alpha_2
            print('Alpha2: ' + code2)

            cur.execute(
                '''
                COPY(
                    SELECT ST_AsGeoJSON(geom) from {naturalearth}.{admin0}
                    WHERE iso_a3='{iso_a3}'
                )
                TO '{path_geojson}/{iso_a2}.geojson';
                '''.format(column=code, naturalearth=schema, admin0=table, iso_a3=code3, iso_a2=code2, path_geojson=GEOJSON_PATH)
            )


            geojsonpath = os.path.join(GEOJSON_PATH, '{}.geojson'.format(code2))
            print(geojsonpath)

            with open(geojsonpath, 'r', encoding='utf-8') as infile:
                data = infile.read()
                g1 = geojson.loads(data)
                g2 = shape(g1)
                inner_geohashes_polygon = polygon_to_geohashes(g2, 4)
                outer_geohashes_polygon = polygon_to_geohashes(g2, 4, False)

                tree = {}
                words = []

                print(inner_geohashes_polygon)

                for geohash in inner_geohashes_polygon:
                    words.append(geohash)
                for geohash in outer_geohashes_polygon:
                    words.append(geohash)

                make_tree(tree, words)
                write_tree(tree, code2, '/tmp/trees')
