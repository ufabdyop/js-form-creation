/**
 * MODELS: Here we are defining all the models in the MVC structure
 * ----------------------------------------------------------------
 * 
 */
var NullInputModel = Backbone.Model.extend({
			defaults: {} 
		});

//a simple wrapper type of object that always shows the dependent input
var NullFormCondition = Backbone.Model.extend({
			defaults: { "field" : new NullInputModel() } ,
			evaluate: function(model, successfulValidation, unsuccessfulValidation) {
				return true;
			}
		});

var FormCondition = Backbone.Model.extend({
	defaults: {
		"field": new NullInputModel(),    //a FormInput
		"operator": "==", // '==', '!=', '<', '>', etc.
		"value": null     //probably a string
	},
	evaluate: function(model, successfulValidation, unsuccessfulValidation) {
		var sub = this.get('field').get('value');
		var comp = this.get('operator');
		var obj = this.get('value'); 
		var evaluation_string = 'sub ' + comp + ' obj' ;
		var should_be_shown = eval( evaluation_string );
		if (should_be_shown) {
			successfulValidation(model);
		} else {
			unsuccessfulValidation(model);
		}
		return should_be_shown;	
	}
});

var FormInputIdIterator = 1;
/**
 * form input
 */
var FormInput = Backbone.Model.extend({
	defaults: {
		"id": false,
		"long_label": false,
		"type": 'text',
		"name": '',
		"label": '',
		"form": null,
		"fieldset": null,
		"value": '',
		"options": {},
		"default_value": '', 
		"view": null,
		"dependencyCondition": null,
		"dependencySatisfiedCallback": null,
		"dependencyNotSatisfiedCallback": null,
		"disabled": false,
		"hidden": false
	},
	initialize: function(attributes) {
		var condition = this.get('dependencyCondition');
		if (condition == null) {
			this.set('dependencyCondition', new NullFormCondition());
		} else {
			this.set('dependencyCondition', new FormCondition(condition));
		}
		if (attributes.id == false) {
			this.set('id', 'FormInputField_' + FormInputIdIterator++);
		}
	},
	renderTo: function(element) {
		this.set('view', new input_view({model: this, element: element}));
		this.get('dependencyCondition').get('field').on('change', this.isDependencySatisfied, this);
		this.initializeCallbacks();
		this.isDependencySatisfied();
	},
	//if callbacks are not explicitly set for dependencies, use some reasonable defaults
	initializeCallbacks: function() {
		if (this.get('dependencySatisfiedCallback') == null) {
			if (this.get('disabled') ) {
				this.set('dependencySatisfiedCallback', this.enable);
			} else {
				this.set('dependencySatisfiedCallback', this.show);
			}
		}
		if (this.get('dependencyNotSatisfiedCallback') == null) {
			if (this.get('disabled') ) {
				this.set('dependencyNotSatisfiedCallback', this.disable);
			} else {
				this.set('dependencyNotSatisfiedCallback', this.hide);
			}
		}
	},
	enable: function (model) {
		model.get('view').unlock();
	},
	disable: function (model) {
		model.get('view').lock();
	},
	show: function (model) {
		model.get('view').show();
	},
	hide: function (model) {
		model.get('view').hide();
	},
	isDependencySatisfied: function() {
		var dependency = this.get('dependencyCondition');
		dependency.evaluate(
			this, 
			this.get('dependencySatisfiedCallback'), 
			this.get('dependencyNotSatisfiedCallback')
		);
	}
});

var FormFieldset = Backbone.Model.extend({
	defaults: {
		name: null,
		collection: null
		},
	initialize: function(attributes) {
		if (attributes.collection == null) {
			this.set('collection', new FormInputCollection());
		}		
	},
	addInput: function(input) {
		var this_handle = this;
		$(input).each( function( index, obj ) {
					if ( 'on' in obj) {
						obj.on('change', this_handle.trigger_change, this_handle);
					}
				} );
		this.get('collection').add(input);
	}, 
	renderTo: function(element) {	
		this.view = new fieldsetView({model: this, element: element});
		this.view.render();
	},
	trigger_change: function(changedObject, changes) {
		this.trigger('inputUpdated', changedObject, changes);
	}
});

var FormInputCollection = Backbone.Collection.extend({ model: FormInput });

var Form = Backbone.Model.extend({
	defaults: {
		action: null,
		name: "",
		method: "post",
		wizard_style: false
	},
	initialize: function(attributes) {
		this.set("fieldset", new FormFieldset({
					name: this.get("name")
				}));
	},
	addInput: function (input) {
		var this_handle = this;
		$(input).each( function( index, obj ) {
					if ( 'on' in obj) {
						obj.on('inputUpdated', this_handle.trigger_change, this_handle);
					}
				} );
		this.get("fieldset").addInput(input);
		this.trigger('change');
	},
	renderTo: function(element) {
		this.view = new FormView({model: this, element: element});
		this.view.render();
	},
	getFieldSets: function () {
		return this.get("fieldset").get("collection");
	},
	hideAll: function () {
		this.getFieldSets().each( function(fieldset) { fieldset.set("hidden", true); } );
	},
	showOneFieldset: function (index) {
		this.hideAll();
		this.getFieldSets().at(index).set("hidden", false);
	},
	trigger_change: function(changedObject, changes) {
		this.trigger('inputUpdated', changedObject, changes);
	}
});

var FormWizard = Backbone.Model.extend({
	defaults: {
		element: null,
		form: null
	},
	renderTo: function(element) {
		this.set('view', new FormWizardView({model: this, element: element}));
		this.get('view').render();
	},
	numberOfSteps: function() {
		return this.get('form').getFieldSets().length;
	}
});

/**
 * TEMPLATES:
 * ---------------------------
 *
 * */
var templates = { 
			"text":  _.template('<div class="text_input" id="container_for_<%=id%>"> \n' + 
					'<label for="text_<%=id %>"><%=name %></label><input type="text" value="<%=value%>" name="<%=name %>" id="text_<%=id %>"/> \n' +
				'</div>\n'),
			"radio":  function (data) { 
					var buffer = (option_templates["radio"](data['options'], data['value']));
					buffer = '<div class="text_input" id="container_for_<%=id%>"> \n' + buffer + '</div> \n';
					return (_.template(buffer))(data);
				},
			"select":  function (data) { 
					var buffer = (option_templates["select"](data['options'], data['value']));
					buffer = '<div class="select_input" id="container_for_<%=id%>"><select name="<%=name %>" id="select_<%=id %>">\n' + buffer + '</select></div> \n';
					return (_.template(buffer))(data);
				},
			"checkbox":  function(data) {	
				var checked_string = '';
				if ('value' in data) {
					if (data['value']) {	
						checked_string = ' checked';
					}
				}
				var buffer = '<div class="checkbox_input" id="container_for_<%=id%>"> \n' + 
					'<label for="checkbox_<%=id %>"><input type="checkbox" ' + checked_string + ' value="<%=value%>" name="<%=name %>" id="checkbox_<%=id %>"/><%=name %></label> \n' +
					'</div>\n';
				return (_.template(buffer))(data)
			} 
		};

var option_templates = {
			"select":  function (options, val) {
					var buffer = "";
					var iterator = 0;
					var selected_text = '';
					for( var value in options ) {
						selected_text = '';
						if (value == val) {
							selected_text = ' selected';
						}
						buffer += '<option name="<%=name %>" id="select_<%=id %>_' + iterator + '" value="' + value + '"' + selected_text + '>' + options[value] + '</option> \n'
						iterator++;
					}
					return buffer;
				},
			"radio":  function (options, val) {
					var buffer = "";
					var iterator = 0;
					var selected_text = '';
					for( var value in options ) {
						selected_text = '';
						if (value == val) {
							selected_text = ' checked';
						}
						buffer += '<input type="radio" value="' + value + '" name="<%=name %>" id="radio_<%=id %>_' + iterator + '"' + selected_text + '/><label for="radio_<%=id %>_' + iterator + '">' + options[value] + '</label> \n'
						iterator++;
					}
					return buffer;
				}  
	}

/**
 * VIEWS:
 * ------------------------------------------------
 */
    var input_view = Backbone.View.extend({
        model: FormInput,
        tagName: 'div',
        template: null,
        input_selector: 'input',
        initialize: function(attributes) {
          this.model.on('change', this.render, this);

	  var model_type = this.model.get('type');
	  this.template = templates[model_type];

          $(attributes.element).append(this.el);
          this.render();  
	  this.set_input_selector();
        },
	set_input_selector: function() {
	  var model_type = this.model.get('type');
	  if (model_type == 'radio') {
		this.input_selector = 'input[checked=checked]';
	  } else if (model_type == 'select') {
		this.input_selector = 'select';
	  } else if(model_type == 'checkbox') {	
		this.input_selector = 'input:checked';
	  } else {
		this.input_selector = 'input';
	  }
	},
        render: function() {
            var markup = this.template({
                                        id: this.model.get('id'),
                                        value: this.model.get('value'),
                                        options: this.model.get('options'),
                                        name: this.model.get('name')
                                    });
	    this.$el.html(markup);
	    if (this.model.get('hidden')) {
		this.hide();
	    } else {
		this.show();
	    }
	    if (this.model.get('disabled')) {
		this.lock();
	    } else {	
		this.unlock();
	    }
        },
	$input: function() {
		return $(this.input());
	},
	input: function() {
		var selector = this.input_selector;
		return this.$el.find(selector)[0];
	},
	value: function() {
		if (this.model.get('type') == 'checkbox') {
			return this.$input().is(":checked");
		}
		return this.$input().val();
	},
	show: function() {
		this.unlock();
		this.$el.show();
	},
	hide: function(callback) {
		this.lock();
		this.$el.hide(0, callback);
	},
	lock: function() {
		this.$input().attr('disabled', 'true');
	},
	unlock: function() {
		this.$input().removeAttr('disabled');
	},
	update_model: function() {
		this.model.off('change', this.render, this);
		this.model.set('value', this.value());
		this.model.on('change', this.render, this);
	},
	events: {
		"change select" : "update_model",
		"change input" : "update_model",
		"keyup input" : "update_model"
	}
    });

var fieldsetView = Backbone.View.extend({
	model: FormFieldset,
	tagName: 'fieldset',
	initialize: function(attributes) {
		$(attributes.element).append(this.el);
		attributes.model.on('change', this.render, this);
	},
	render: function() {
		this.$el.html('');
		this.$el.attr('id', 'fieldset_' + this.model.cid);
		this.$el.html('<legend>' + this.model.get('name') + '</legend>');
		var render_to = this.el;
		this.model.get('collection').each(function(input, var2, var3) {
			input.renderTo(render_to);		
		});
		if (this.model.get('hidden') == true) {
			this.$el.hide();
		} else {
			this.$el.show();
		}
	}
});


var FormView = Backbone.View.extend({
	model: Form,
	tagName: 'form',
	initialize: function(attributes) {
		$(attributes.element).append(this.el);
		attributes.model.on('change', this.render, this);
	},
	render: function() {
		this.$el.attr("action", this.model.get("action"));
		this.$el.html('');
		this.model.get('fieldset').renderTo(this.el);
	}
});

var FormWizardView = Backbone.View.extend({
	model: FormWizard,
	tagName: 'div',
	initialize: function(attributes) {
		this.el = attributes.element;
		this.$el = $(this.el);
		attributes.model.on('change', this.render, this);
	},
	render: function() {
		this.$el.html('<div id="wizard_form_' + this.model.cid + '"></div><input type="button" class="wizard-forward-button" value="Forward"></input>');
		this.model.get('form').renderTo($('#wizard_form_' + this.model.cid));
	}
});

