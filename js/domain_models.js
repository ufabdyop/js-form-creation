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

/**
 * TEMPLATES:
 * ---------------------------
 *
 * */
var templates = { 
			"text":  _.template('<div class="text_input" id="container_for_<%=id%>"> \n' + 
					'<label for="<%=id %>"><%=name %><input type="text" value="<%=value%>" name="<%=name %>" id="text_<%=id %>"/></label> \n' +
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
					'<input type="checkbox" ' + checked_string + ' value="<%=value%>" name="<%=name %>" id="checkbox_<%=id %>"/><label for="checkbox_<%=id %>"><%=name %></label> \n' +
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
