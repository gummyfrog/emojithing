class Common {

    getFormData() {
    /* return nested array combined
       into groups of two. See question @ 
       https://stackoverflow.com/a/31352555/4746328 */

    function groupIntoPairs(arr) {
        var temp = arr.slice();
        var out = [];

        while (temp.length) {
            out.push(temp.splice(0,2));
        }

        return out;
    }

    /* create a storage object */
    var data = {},
    /* get 'input' elements as an array */
    inputs = [].slice.call(document.getElementById('myform').querySelectorAll('input')),
    /* additional variables */
    name, hold, splits, L, dKey;

    /* loop through input elements */
    inputs.forEach(function(n) {
        name = n.name;

        /* for holding key strings */
        hold = '';

        /* split the 'name' at '.'
           and group into pairs */ 
        splits = groupIntoPairs( name.split('.') );

        /* index of last item in 'splits' */
        L = splits.length - 1;

        /* if 'splits' has only one
           item add the name-value pair
           to 'data' straight away */
        if (L === 0) {
            data[name] = n.value;
        } else {
            /* loop 'splits' to create keys */
            splits.forEach(function(x, i) {
                /* combine key strings until
                   last item in 'splits' */
                if (i !== L) hold += '.' + x.join('.');
            });

            /* define the key */
            dKey = hold.slice(1);

            /* create 'data[dKey]' Object if
               it doesn't exist or use it
               again if it does */
            data[dKey] = data[dKey] || {};

            /* add last item in 'splits' as 
               key for 'data[dKey]' and 
               assign current n.value */
            data[dKey][splits[L][0]] = n.value;                
        }
    });
    /* return 'data' object */
    return data;
}

}

module.exports = Common;