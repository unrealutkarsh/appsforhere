function saveItemToLocalModel() {
    if (!selectedProduct) {
        // Adding one.
        selectedProduct = {};
        model.products.push(selectedProduct);
    }
    selectedProduct.name = $('#itemName').val();
    selectedProduct.price = $('#itemPrice').val();
    selectedProduct.description = $('#itemDesc').val();
    selectedProduct.photoUrl = $('#itemImageUrl').val();
    if ($categorySelect[0].selectize.getValue().length > 0) {
        selectedProduct.tags = $categorySelect[0].selectize.getValue().split(',');
    } else {
        selectedProduct.tags = [];
    }
    if ($modSelect[0].selectize.getValue().length > 0) {
        selectedProduct.options = $modSelect[0].selectize.getValue().split(',');
    } else {
        selectedProduct.options = [];
    }
    var variants = $variantSelect[0].selectize.getValue().split(',');
    if (variants.length) {
        selectedProduct.variations = [];
        for (var vi = 0; vi < variants.length; vi++) {
            for (var ei = 0; ei < variantsBeingEdited.length; ei++) {
                if (variantsBeingEdited[ei].name === variants[vi]) {
                    selectedProduct.variations.push(variantsBeingEdited[vi]);
                    break;
                }
            }
        }
    } else {
        delete selectedProduct.variations;
    }
    selectedProduct.taxRateName = $taxSelect[0].selectize.getValue();
    selectedProduct.priceType = $('#itemPriceVaries').is(':checked') ? "VARIABLE" : "FIXED";
    selectedProduct.quantityType = $('#itemFractional').is(':checked') ? "FRACTIONAL" : "WHOLE";
    $('#productGrid').repeater('render');
    $('#itemModal').modal('hide');
    selectedProduct = null;
    variantsBeingEdited = [];
}

function showItem(product) {
    $('#itemForm').data('bootstrapValidator').resetForm();
    $('#itemName').val(product.name);
    $('#itemPrice').val(product.price ? new BigNumber(product.price).toFixed(2) : "");
    $('#itemDesc').val(product.description);
    $('#itemImage').attr("src", product.photoUrl ? product.photoUrl : '/media/image_default_138.png');
    $('#itemImageUrl').val(product.photoUrl);
    $('#itemPriceVaries').prop('checked', product.priceType && product.priceType.toLowerCase() === "variable");
    $('#itemFractional').prop('checked', product.quantityType && product.quantityType.toLowerCase() == "fractional");
    if (product.variations) {
        // Copy these so they can be edited separately
        for (var i = 0; i < product.variations.length; i++) {
            variantsBeingEdited.push({
                name:product.variations[i].name,
                price:product.variations[i].price,
                nameWithPrice: nameWithPrice(product.variations[i].name, product.variations[i].price)
            });
        }
    }
    fillVariations();
    fillModifiers(selectedProduct?selectedProduct.options:[], false);
    $categorySelect[0].selectize.setValue(product.tags ? product.tags.join(",") : "");
    $taxSelect[0].selectize.setValue(product.taxRateName);
    $('#itemModal').modal();
}

function setupItemModal() {
    $("#itemPrice").money_field({});
    $('#deleteItem').on('click', function () {
        if (selectedProduct) {
            model.products.splice($.inArray(selectedProduct, model.products), 1);
            selectedProduct = null;
            $('#productGrid').repeater('render');
        }
        $('#itemModal').modal('hide');
    });
    $categorySelect = $("#itemCats").selectize({
        delimiter: ',',
        persist: true,
        openOnFocus: true,
        hideSelected: true,
        valueField: 'name',
        labelField: 'name',
        searchField: ['name'],
        plugins: ['remove_button'],
        create: function (input) {
            model.tags.push({name: input});
            return {
                name: input
            };
        }
    });
    $modSelect = $('#itemModifiers').selectize({
        delimiter: ',',
        persist: false,
        openOnFocus: true,
        hideSelected: true,
        sortField: 'name',
        valueField: 'name',
        labelField: 'name',
        searchField: ['name'],
        plugins: ['remove_button'],
        create: false
    });
    $variantSelect = $('#itemVariations').selectize({
        delimiter: ',',
        persist: false,
        openOnFocus: false,
        hideSelected: true,
        sortField: 'name',
        valueField: 'name',
        labelField: 'nameWithPrice',
        plugins: ['remove_button', 'drag_drop'],
        create: function (input) {
            addVariant();
            $('#variantName').val(input);
            return null;
        }
    });
    $('#itemVariations_div').on('click', '.item', function (e) {
        var itemVal = $(this).data().value;
        for (var i = 0; i < variantsBeingEdited.length; i++) {
            if (variantsBeingEdited[i].name === itemVal) {
                selectedVariant = variantsBeingEdited[i];
                $('#variantForm').data('bootstrapValidator').resetForm();
                $('#variantName').val(selectedVariant.name);
                $('#variantPrice').val(new BigNumber(selectedVariant.price).toFixed(2));
                $('#variantModal').modal();
                return;
            }
        }
    });
    $('#itemModal')
        .on('change', '.btn-file :file', function () {
            var input = $(this),
                numFiles = input.get(0).files ? input.get(0).files.length : 1,
                label = input.val().replace(/\\/g, '/').replace(/.*\//, '');
            $("#importModal").modal('hide');

            var formData = new FormData();
            selectedProduct.photoUrl =
                formData.append('imageupload', $("#imageupload")[0].files[0]);
            uploadSomething('/products/image', formData, function (err, rz) {
                $('#itemImage').attr("src", rz.url);
                $('#itemImageUrl').val(rz.url);
            });
        });
    $('#itemForm').bootstrapValidator({
        live: 'enabled',
        feedbackIcons: {
            valid: 'glyphicon glyphicon-ok',
            invalid: 'glyphicon glyphicon-remove',
            validating: 'glyphicon glyphicon-refresh'
        },
        fields: {
            itemName: {
                validators: {
                    notEmpty: {
                        message: 'A name is required.'
                    }
                }
            },
            itemPrice: {
                validators: {
                    numeric: {
                        message: 'A valid price is required (or 0)'
                    }
                }
            }
        }
    }).on('success.form.bv', function(e) {
        e.preventDefault();
        saveItemToLocalModel();
    });
}