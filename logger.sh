#!/bin/bash

while getopts "haf:v:c:d:" opt
  do
    case $opt in
      f ) FILES=$OPTARG ;;
      v ) FIELDS=$OPTARG ;;
      c ) CONSTRAINTS=$OPTARG ;;
      a ) VIEWALL=true ;;
      d ) CONTAINERS=$OPTARG ;;
      h ) HELP=true ;;
    esac
done

if [ "$HELP" = true ] ; then
  printf "Usage: ./logger.sh -f \"files\" -d \"containers\" (one is required)\n                   -v \"fields\" (optional)\n                   -c \"constraints\" (optional)\n                   -a (view all fields, optional)\n"
  exit 0
fi


ADDITIONALTAGS=""
if [ "$VIEWALL" = true ] ; then
  ADDITIONALTAGS="$ADDITIONALTAGS -a"
fi

FILENUM=0;
CONNUM=0;
TRAP=""
FILESTRING=""
BUFFERSTRING=""
CONSTRING=""
CONBUFFER=""
declare -a BGARRAY
declare -a CONBGARRAY
declare -a STARTARRAY

#for CONTAINER in $CONTAINERS do
for CONTAINER in $CONTAINERS; do
    CONSTRING="$CONSTRING $CONTAINER"
    CONBUFFER="$CONBUFFER buffer$CONTAINER"

    TRAP="$TRAP kill \${CONBGARRAY[$CONNUM]};"
    #echo $TRAP
    docker logs -f $CONTAINER >& $CONTAINER &
    sleep 1s
    CONBGARRAY[$CONNUM]=$!
    CONNUM=$((CONNUM+1))
    TRAP="$TRAP kill \${CONBGARRAY[$CONNUM]};"

    CONSTARTARRAY[$CONNUM]=$( wc -l < $CONTAINER )
    #echo ${CONSTARTARRAY[$CONNUM]}
    CONSTARTARRAY[$CONNUM]=`expr ${CONSTARTARRAY[$CONNUM]} + 1`
    #echo ${CONSTARTARRAY[$CONNUM]}


    tail -n+"${CONSTARTARRAY[$CONNUM]}" -F $CONTAINER > buffer$CONTAINER &
    CONBGARRAY[$CONNUM]=$!

    CONNUM=$((CONNUM+1))
done
#done
TRAP="$TRAP kill \${CONBGARRAY[$CONNUM]};"

for FILE in $FILES; do
    FILESTRING="$FILESTRING $FILE"
    BUFFERSTRING="$BUFFERSTRING buffer$FILENUM"

    TRAP="$TRAP kill \${BGARRAY[$FILENUM]};"
    #echo $TRAP

    STARTARRAY[$FILENUM]=$( wc -l < $FILE )
    echo ${STARTARRAY[$FILENUM]}
    STARTARRAY[$FILENUM]=`expr ${STARTARRAY[$FILENUM]} + 1`
    echo ${STARTARRAY[$FILENUM]}

    tail -n+"${STARTARRAY[$FILENUM]}" -F $FILE > buffer$FILENUM &
    BGARRAY[$FILENUM]=$!

    FILENUM=$((FILENUM+1))
done

TRAP="$TRAP kill \${BGARRAY[$FILENUM]};"
TRAP="$TRAP exit"

trap "eval $TRAP" SIGINT

sort -nbms -k1.20,1.32 $FILESTRING $CONSTRING > combined.log
#sort -nbms -k1.11,1.13 $FILESTRING $CONSTRING > combined.log

tail -n+0 -qF $BUFFERSTRING $CONBUFFER >> combined.log &
BGARRAY[$FILENUM]=$!

node largeLogger.js $ADDITIONALTAGS -v $FIELDS -c $CONSTRAINTS