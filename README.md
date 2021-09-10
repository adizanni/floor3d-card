# floor3d-card

[![hacs_badge](https://img.shields.io/badge/HACS-Default-orange.svg?style=for-the-badge)](https://github.com/custom-components/hacs)

Javascript Module for the Home Assistant visualization Card for 3D Models with bindings to entity states. Be advised it is still an alfa version; it requires a bit of manual installation actions and related troubleshooting. I'm working at a more official and easy to setup version using card templates projects.

|Demo [![Alt text](https://img.youtube.com/vi/M1zlIneB3e0/0.jpg)](https://www.youtube.com/watch?v=M1zlIneB3e0)   | Tutorial [![Alt text](https://img.youtube.com/vi/RVDNxt2tyhY/0.jpg)](https://www.youtube.com/watch?v=RVDNxt2tyhY)  |
|---|---|

## Installation

The card is now accepted in the default repositories of HACS just search for floor3d in the HACS frontend section and install.

You can also  download the compiled js file from here (https://github.com/adizanni/floor3d-card/releases/download/latest/floor3d-card.js) and upload it to your www home assistant folder

It's **required** to load this card as `module`.

```yaml
- url: /local/pathtofile/floor3d-card.js
  type: module
```

## Model Design and Installation
Use a 3D modeling software. As you have to model your home I would suggest this software (the one I tested): http://www.sweethome3d.com/.
Model your home with all needed objects and furniture (I will post here some hints on how to better design your home for best results with the custom card).
For further instruction I assume you will use SweetHome3D.
At the end of your modeling, you need to export the files in obj format using '3D View \ Export to OBJ format ...', specify the folder where you want to store the output (be careful there are multiple files)
Copy the full set of files (minimum is the .obj file and .mtl file) to a sub folder of /config/www in Home assistant.
Be aware that when you remove objects from the model the object ids get reassigned: This means that after a modification and re-export of your model it is possible you need to redo the bindings with the new object names. The new feature (https://github.com/adizanni/floor3d-card/issues/7) is now available in this repository https://github.com/adizanni/ExportToHASS. It is a new plugin for Sweethome3D. It is still very experimental, use at your own risk, and please follow the instructions.
It could be also good practice to make the objects invisble instead of removing them (not yet tested if this solution preserves the objects ids). 

If you want to have an object that groups together other objects (ex a mannequin is composed by 100s of objects you want to treat it as one), you can follow this trick: https://community.home-assistant.io/t/live-3d-floor-plan-with-interactive-objects/301549/78?u=adizanni.


Based on some feedback there are some open issues which I will try to fix, please follow these rules if you want things to go smooth:

- Place the upper left corner of your 2D floor model at 0,0 coordinates otherwise the camera setting will work weirdly (due to calculation on the coordinates that I need to fix) 

When you are finished,  configure a new card (either in panel mode or regular) with the following options:

## Options

| Name | Type | Default | Description
| ---- | ---- | ------- | -----------
| type | string | **Required** | `custom:floor3d-card`.
| name | string | Floor 3d | the name of the card.
| entities | array | none | list of enitities to bind to 3D model objects.
| object_groups | array | none | list of object groups to apply grouped entity bindings.
| style | string | none | the style that will be applied to the canvas element of the card.
| path | string | **Required** | path to the Waterforont obj (objects), mtl (material) and other files.
| objfile | string | **Required** | object file name (.obj) Waterfront format.
| mtlfile | string | **Required** | material file name (.mtl) Waterfront format.
| backgroundColor | string | '#aaaaaa' | canvas background color
| globalLightPower  | float | 0.3 | intensity of the light illuminating the full scene it can also the name of a numeric sensor
| shadow | string | no | 'yes' if lights cast shadow on object. This is  realistic but impacts performances. By default wall, floors and objects with "door" in the name, receives and cast shadows


For each entity in the entities list you need to specify the following options:

| Name | Type | Default | Description
| ---- | ---- | ------- | -----------
| entity | string | **Required** | your entity id or reference to an object_group via <object_group> reference (this last feature is not applicable for text and gesture 
| entity_template | string | none | a JavaScript template formatted as follow: [[[ template ]]]. Template is a valid Javascript command. With $entity you specify  the state of the entity
| object_id | string | **Required** | the name of the object in the model to biind to your entity.
| type3d | string | **Required** | the type of object binding. Values are: light, hide, color, text, gesture, door, rotate

**Note: to facilitate the configuration you can load the model without entity bindings and you will be able to show the object_id you want to bind to by double clicking on the object**

For each object_group in object_groups:

| Name | Type | Default | Description
| ---- | ---- | ------- | -----------
| object_group | string | **Required** | your object group name to be referenced by the entity field via <object_group> reference (braces <> have to wrap the object_group name)
| objects | array | **Required** | the list of object_ids in your group.

The objects array contains a list of 
| Name | Type | Default | Description
| ---- | ---- | ------- | -----------
| object_id | string | **Required** | object_id of the object in the group

### Client Side Javascript template example

```yaml
  - entity: sensor.temperature
    type3d: color
    colorcondition:
      - color: red
        state: hot
    object_id: your_object
    entity_template: '[[[ if ($entity > 25) { "hot" } else { "cool" } ]]]'

```
The example above shows a potential usage of the Client Side Javascript template example. If the state of the entity is greater than 25, the templated state of the entity will be 'hot' thus the object 'your_object' will become red

## Camera Rotation and Camera Position

For **camera rotation and position** recording config:
```yaml
camera_position:
  x: <x coordinate of the recorded camera positioon>
  y: <y coordinate of the recorded camera positioon>
  z: <z coordinate of the recorded camera positioon>
camera_rotate:
  x: <x coordinate of the recorded camera rotation>
  y: <y coordinate of the recorded camera rotation>
  z: <z coordinate of the recorded camera rotation>
```
When in edit mode you can double click in an empty model space to retrieve the current postition and rotation of the camera. You can retrieve the 2 sets of coordinates from the prompt box that will appear. You can then manually copy the content and paste to the card config in code editor mode. Thanks to this the new default position of the camera will be set to the configured coordinates. 

## Lights

For **light** example config:
```yaml
entities:
  - entity: <a light entity id>
    type3d: light
    object_id: <an object id in the 3D model you want to postion the light on>
    light:
      lumens: <max light lumens range: 0-4000 for regular led/bulb lights>
```

light_name is the name of the light object that will be created in the model to do the actual illumination.

Light behaviour is obvious: the **light_name** will illuminate when the bound entity in Home Assistant will be turned on and viceversa. If the light has color and brightness attributes they will be used to render the light.
A double click on the light object will toggle the light (so far the events in iOS and Android are not yet managed as the events are captured by the OrbitContol of Three.js library and I have not yet fully understood the behaviour)

## Hide

For **hide** example config:
```yaml
entities
  - entity: <a binary sensor entity id>
    type3d: hide
    object_id: <an object_id in the model you want to hide if condition is true>
    hide:
      state: <the state of the entity triggering the hiding of the object: ex 'off'>
```

Hide behavour: the object_id will be hidden when the state of the bound entity will be equal to the **state** value

## Show

For **show** example config:
```yaml
entities
  - entity: <a binary sensor entity id>
    type3d: show
    object_id: <an object_id in the model you want to show if condition is true>
    show:
      state: <the state of the entity triggering the showing of the object: ex 'off'>
```

Show behavour: the object_id will be visible when the state of the bound entity will be equal to the **state** value

## Color

For **color** example config:
```yaml
entities:
  - entity: <a discrete sensor entity id>
    type3d: color 
    object_id: <the object id in the 3D model that has to change color based on the state of the entity>
    colorcondition:
      - color: <color to paint if condition for the entity id in the stat to be true, it can be in Hex, html or rgb format (ex. '#ff0000' or 'red' or '255, 0, 0' >
        state: <state of the entity>
      .......
```

Color behavour: the object_id will be painted in the color when the state of the bound entity will be equal to the **state** value

## Text

For **text** example config:
```yaml
entities:
  - entity: <a numeric or text sensor entity id>
    type3d: text
    object_id: <the plane object id in the 3D model that will allow the display of the state text>
    text:
      span: <percentage span of text in the object plane> (ex. 50%)
      font: <name of the font text ex:'verdana'>
      textbgcolor: <background color for the text. ex: '#000000' or 'black'>
      textfgcolor: <foreground color for the text. ex: '#ffffff' or 'white'>
      .......
```

Text behaviour: the object_id representing the plane object (ex. mirror; picture, tv screen, etc) will display the state text for the entity

## Gesture

For **gesture** (action) example config:
```yaml
entities:
  - entity: <an actionable entity>
    type3d: gesture
    object_id: <an object id in the 3D model you want to double click to trigger the gesture/action>
    gesture:
      domain: <the domain of the service to call>
      service: <the service to call>
```
when you double click on the object, the domain.service is called with data { entity_id: entity }
(so far the iOS and Android events are not yet managed as the events are captured by the OrbitContol of Three.js library and I have not yet fully understood the behaviour)

## Door

For **door** example config:
```yaml
entities:
  - entity: <a on/off  entity>
    type3d: door
    object_id: <an object or object_group id representing the door>
    door:
      doortype: <'slide' for sliding doors/windows, 'swing' for swinging doors windows>
      side: 'up', 'down', 'left' and 'right', the border of the door that is the axis of rotation
      direction: 'inner' and 'outer', the direction of rotation
      hinge: the object_id of the door/window hinge
      pane: the object_id of the pane (main component) of the door/window
      degrees: the degrees of the door opening
```
a door/window object/entity is rotated by the sepcified degrees (swing) or slid (slide) along the axis defined in 'side' and the direction defined in 'direction'. You can use the object group to list the moving objects of the door. If you do that you can now select the hinge object or the pane object. When you select the hinge object only the direction parameter is used as the side and axix of rotation are bound to the hinge position and shape. Time allowing I will try to do a tutorial. It is getting complex.....

Example of configuration for a window (Double French Window) exported using the ExportToHass plugin:

![image](https://user-images.githubusercontent.com/35622920/132490828-37eed144-d86b-4ef0-93ec-4be5d8131da5.png)

The entity section:
```yaml
  - entity: your_domain.your_door_entity
    object_id: <WindowDiningRoomLeft>
    type3d: door
    door:
      doortype: swing
      direction: inner
      degrees: '50'
      hinge: WindowDiningRoomLeft_4
```

And the related object group:

```yaml
  - object_group: WindowDiningRoomLeft
    objects:
      - object_id: WindowDiningRoomLeft_7
      - object_id: WindowDiningRoomLeft_6
      - object_id: WindowDiningRoomLeft_5
```

Result:

![image](https://user-images.githubusercontent.com/35622920/132490500-b6b40948-5f5b-4127-9d8e-5ae580c1e880.png)

![image](https://user-images.githubusercontent.com/35622920/132490620-0dcf2614-4b28-40e5-ab9e-d01453e37d90.png)

## Rotate

For **rotate** example config:
```yaml
entities:
  - entity: <a on/off  entity>
    type3d: rotate
    object_id: <an object or object group id representing the thing to be rotated>
    rotate:
      axis: <'x', 'y' and 'z', along which axis the object should rotate>
      round_per_seconds: 1-4, speed of rotation. Use a negative number to spin the other direction.
      percentage:
      hinge: the object acting as a pivot when you use an object group to represent the moving parts.
```
an object to rotate (animation) when the associated entity will be 'on'. If you use an object group and you specify the hinge, all moving parts in the group will rotate aroung the hinge center point. 

## Object group example

```yaml
entities:
  - entity: light.bulb
    type3d: light
    object_id: <lamp> (refers to the object_group defined below, braces <> have to wrap the object_group name)
    light:
      lumen: 900
object_groups:
  - object_group: lamp
    objects:
      - object_id: lamp_base_20
      - object_id: lamp_bulb_1
```



### Example

To give it a try please, load the example folder files in a folder within /config/www of your Home Assistant.
Create a new Panel View add Floor3d-card and cut and paste the following config:

```yaml
type: 'custom:floor3d-card'
entities:
  - entity: <your light entity id>
    type3d: light
    object_id: sweethome3d_opening_on_hinge_2_LampSide_31
    light:
      lumens: 500
  - entity: <your binary sensor entity id (example a magnet sensor for a window)>
    type3d: color
    object_id: sweethome3d_window_pane_on_hinge_1_50
    colorcondition:
      - state: 'on'
        color: '#00ff00'
      - state: 'off'
        color: '#ff0000'
path: /local/home2/
objfile: MyExampleHome2.obj
mtlfile: MyExampleHome2.mtl
backgroundColor: '#000001'
globalLightPower: 0.4
```


### To Do

Project General Availability (https://github.com/adizanni/floor3d-card/projects/1)



