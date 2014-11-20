/**
 * Clean up and send the product model to the server to be published
 *
 * If modelName is non-null, this will do a "local" save to appsforhere, else it's a publish.
 */
function publishModel(modelName,cb) {
    $('#progressAlert').attr('aria-hidden', 'true').css('display', 'none');
    $('#progressBar').css('width', 0).attr('aria-valuenow', 0);
    $('#progressModal').modal('show');

    var serverModel = {
        products: [],
        taxRates: [],
        // These are unmodified, so just copy
        tags: model.tags,
        options: []
    };

    var i, trIds = {}, pids = {};
    // We need to assign ids to anything that doesn't have one
    for (i = 0; i < model.taxRates.length; i++) {
        var tr = model.taxRates[i];
        if (tr.id) {
            trIds[tr.id] = tr;
        }
    }
    for (i = 0; i < model.taxRates.length; i++) {
        var tr = model.taxRates[i];
        if (!tr.id) {
            var maybeId = 1;
            while (trIds[maybeId]) {
                maybeId++;
            }
            tr.id = maybeId;
        }
        serverModel.taxRates.push({
            name: tr.name,
            default: tr.default ? true : false,
            id: tr.id,
            rate: tr.rate
        });
    }
    for (i = 0; i < model.products.length; i++) {
        var p = model.products[i];
        if (p.id) {
            pids[p.id] = p;
        }
    }
    if (model.options) {
        for (i = 0; i < model.options.length; i++) {
            var opt = {
                name: model.options[i].name,
                select: model.options[i].select,
                values: []
            };
            for (var vi = 0; vi < model.options[i].values.length; vi++) {
                opt.values.push({
                    name: model.options[i].values[vi].name,
                    price: model.options[i].values[vi].price
                });
            }
            serverModel.options.push(opt);
        }
    }
    for (i = 0; i < model.products.length; i++) {
        var p = model.products[i];
        if (!p.id) {
            var maybeId = 1;
            while (pids[maybeId]) {
                maybeId++;
            }
            p.id = maybeId;
            pids[maybeId] = p;
        }
        var serverProduct = {
            id: p.id,
            name: p.name,
            price: p.price,
            tags: p.tags,
            barcode: p.barcode
        };
        if (p.variations && p.variations.length) {
            serverProduct.variations = [];
            for (var vi = 0; vi < p.variations.length; vi++) {
                serverProduct.variations.push({
                    name: p.variations[vi].name,
                    price: p.variations[vi].price
                });
            }
        }
        serverProduct.options = p.options;
        if (p.description && p.description.length) {
            serverProduct.description = p.description;
        }
        if (p.photoUrl && p.photoUrl.length) {
            serverProduct.photoUrl = p.photoUrl;
        }
        if (p.priceType) {
            serverProduct.priceType = p.priceType;
        }
        if (p.quantityType) {
            serverProduct.quantityType = p.quantityType;
        }
        if (p.taxRateName) {
            serverProduct.taxRateName = p.taxRateName;
        }
        serverModel.products.push(serverProduct);
    }
    $.ajax({
        dataType: 'json',
        data: {model: JSON.stringify(serverModel), _csrf: _csrf, name: modelName},
        url: modelName ? '/products/save':'/products/publish',
        type: 'POST',
        cache: false,
        success: function (data) {
            if (data && !data.success) {
                $('#progressError').html(data.message);
                $('#progressAlert').css('display', 'block').alert();
                return;
            }
            $('#progressBar').css('width', 100).attr('aria-valuenow', 100);
            $('#progressModal').modal('hide');
            bootbox.dialog({
                title: 'Success!',
                message: modelName ?
                    'The model has been saved. Click \'Publish to PayPal Here\' to activate the model in the PayPal Here app.' :
                    'The model has been published. You may need to logout and log back into PayPal Here to see changes.',
                buttons: {
                    "ok": {
                        label: 'OK'
                    }
                }
            });
            if (cb) {
                cb(null, data);
            }
        },
        error: function (xhr, type, error) {
            $('#progressError').html(error);
            $('#progressAlert').css('display', 'block').alert();
            if (cb) {
                cb(error);
            }
        }
    });
}
